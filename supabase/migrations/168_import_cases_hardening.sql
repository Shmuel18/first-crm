-- =============================================================================
-- Migration 168: import_cases hardening (R3-import-2 + R3-import-3)
-- =============================================================================
-- Replaces the mig-125 body with three changes; everything else is identical:
--
-- (1) AUTHORIZATION: require is_admin(), not just create_case. The UI policy
--     is admin-only (/settings/import page + importCasesAction both gate on
--     admin), but the RPC accepted any active create_case holder — letting an
--     advisor POST directly to /rest/v1/rpc/import_cases and bypass the admin
--     gate, the 5/hour rate limit, the 2000-row cap and import_jobs logging.
--
-- (2) ROW CAP: refuse payloads over 2000 rows inside the function, so the TS
--     cap can't be bypassed and a giant array can't hold a long transaction.
--
-- (3) LOUD FALLBACKS (PASS 1): a non-empty status that matches nothing now
--     errors with 'unknown_status' instead of silently becoming case_opened;
--     a non-empty advisor_email that matches no ACTIVE profile errors with
--     'unknown_advisor' instead of silently assigning the importer (or a
--     deactivated member). Blank values keep the documented defaults.
--
-- Deploy order: safe in either direction — current prod code calls the RPC
-- only from the admin-gated action, so the stricter gate changes nothing for
-- legitimate callers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.import_cases(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_idx int := 0;
  v_created int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_status_id uuid;
  v_advisor_id uuid;
  v_borrower_id uuid;
  v_case_id uuid;
  v_first text;
  v_last text;
  v_nid text;
  v_status_txt text;
  v_advisor_email text;
  v_seen_nids text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  -- Admin-only: matches the UI policy (settings/import page + action).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'invalid payload' USING ERRCODE = '22023';
  END IF;
  -- Server-side mirror of the TS MAX_ROWS cap.
  IF jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'too many rows' USING ERRCODE = '22023';
  END IF;

  -- ---- PASS 1: validate everything, collect ALL errors, write NOTHING --------
  v_idx := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    v_first := NULLIF(btrim(v_row->>'first_name'), '');
    v_last  := NULLIF(btrim(v_row->>'last_name'), '');
    v_nid   := NULLIF(btrim(v_row->>'national_id'), '');

    IF v_first IS NULL AND v_last IS NULL THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'missing_name');
    END IF;

    IF v_nid IS NOT NULL THEN
      IF v_nid = ANY(v_seen_nids) THEN
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'duplicate_in_file');
      ELSE
        v_seen_nids := array_append(v_seen_nids, v_nid);
        IF EXISTS (
          SELECT 1 FROM public.borrowers
           WHERE national_id = v_nid AND deleted_at IS NULL
        ) THEN
          v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'national_id_exists');
        END IF;
      END IF;
    END IF;

    -- Non-empty status must match a real status (key / Hebrew / English name).
    v_status_txt := NULLIF(btrim(v_row->>'status'), '');
    IF v_status_txt IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.case_statuses
       WHERE key = v_status_txt
          OR lower(name_he) = lower(v_status_txt)
          OR lower(name_en) = lower(v_status_txt)
    ) THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'unknown_status');
    END IF;

    -- Non-empty advisor_email must match an ACTIVE profile.
    v_advisor_email := NULLIF(btrim(v_row->>'advisor_email'), '');
    IF v_advisor_email IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles
       WHERE lower(email) = lower(v_advisor_email)
         AND is_active = TRUE
         AND deleted_at IS NULL
    ) THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'unknown_advisor');
    END IF;
  END LOOP;

  -- All-or-nothing: any problem aborts the whole import with a full report.
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object('created', 0, 'errors', v_errors);
  END IF;

  -- ---- PASS 2: insert every row in THIS transaction (rolls back on any error) -
  v_idx := 0;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    v_first := NULLIF(btrim(v_row->>'first_name'), '');
    v_last  := NULLIF(btrim(v_row->>'last_name'), '');

    -- Status: PASS 1 guaranteed any non-empty value matches; blank → default.
    v_status_txt := NULLIF(btrim(v_row->>'status'), '');
    v_status_id := NULL;
    IF v_status_txt IS NOT NULL THEN
      SELECT id INTO v_status_id FROM public.case_statuses
       WHERE key = v_status_txt
          OR lower(name_he) = lower(v_status_txt)
          OR lower(name_en) = lower(v_status_txt)
       LIMIT 1;
    END IF;
    IF v_status_id IS NULL THEN
      SELECT id INTO v_status_id FROM public.case_statuses WHERE key = 'case_opened' LIMIT 1;
    END IF;
    IF v_status_id IS NULL THEN
      RAISE EXCEPTION 'import_cases: case_opened status row missing — seed not loaded';
    END IF;

    -- Advisor: PASS 1 guaranteed any non-empty email matches an ACTIVE
    -- profile; blank → the importer.
    v_advisor_email := NULLIF(btrim(v_row->>'advisor_email'), '');
    v_advisor_id := NULL;
    IF v_advisor_email IS NOT NULL THEN
      SELECT id INTO v_advisor_id FROM public.profiles
       WHERE lower(email) = lower(v_advisor_email)
         AND is_active = TRUE
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    INSERT INTO public.borrowers
      (first_name, last_name, national_id, phone, email, created_by, updated_by)
    VALUES
      (v_first, v_last,
       NULLIF(btrim(v_row->>'national_id'), ''),
       NULLIF(btrim(v_row->>'phone'), ''),
       NULLIF(btrim(v_row->>'email'), ''),
       v_uid, v_uid)
    RETURNING id INTO v_borrower_id;

    INSERT INTO public.cases
      (status_id, assigned_advisor_id, primary_borrower_id, short_note, created_by, updated_by)
    VALUES
      (v_status_id, COALESCE(v_advisor_id, v_uid), v_borrower_id,
       NULLIF(btrim(v_row->>'short_note'), ''), v_uid, v_uid)
    RETURNING id INTO v_case_id;

    INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
    VALUES (v_case_id, v_borrower_id, 'borrower', TRUE);

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'errors', '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.import_cases(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_cases(jsonb) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (168) ON CONFLICT DO NOTHING;
