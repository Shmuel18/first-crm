-- Bulk-import cases (with a primary borrower) from a parsed file.
--
-- Each row is processed in its own sub-transaction (BEGIN/EXCEPTION), so one
-- bad row doesn't abort the whole import — it's recorded in the errors array
-- and the rest continue. Lookups: status by key/name (default case_opened),
-- advisor by email. SECURITY DEFINER + has_permission('create_case') gate.
--
-- Row shape: { first_name, last_name, national_id, phone, email, status,
--              advisor_email, short_note }
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
  v_status_txt text;
  v_advisor_email text;
BEGIN
  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'invalid payload' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    BEGIN
      v_first := NULLIF(btrim(v_row->>'first_name'), '');
      v_last := NULLIF(btrim(v_row->>'last_name'), '');
      IF v_first IS NULL AND v_last IS NULL THEN
        RAISE EXCEPTION 'missing client name';
      END IF;

      -- Status: match key / Hebrew / English name (case-insensitive); else default.
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

      -- Advisor: match by email; falls back to the importer.
      v_advisor_email := NULLIF(btrim(v_row->>'advisor_email'), '');
      v_advisor_id := NULL;
      IF v_advisor_email IS NOT NULL THEN
        SELECT id INTO v_advisor_id FROM public.profiles
        WHERE lower(email) = lower(v_advisor_email) LIMIT 1;
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
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'message', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.import_cases(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_cases(jsonb) TO authenticated;
