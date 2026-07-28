-- =============================================================================
-- Migration 223: "active cases" excludes closed + on-hold statuses
-- =============================================================================
-- Kaufman: the dashboard header said "94 active cases" while the list showed
-- 86 rows. The tab badge (cases_dashboard_bootstrap counts.active) counted
-- EVERY non-archived case regardless of status, while the list hides
-- closed/on-hold cases by default (hideClosedFrozen + isFrozenCase). Moving a
-- case to "נסגר" therefore never moved the number. His rule: whatever moves to
-- closed (or the archive) is not active.
--
-- Fix: one canonical count function, count_active_cases(), used by BOTH the
-- bootstrap RPC and the client-side realtime fingerprint
-- (cases-realtime-refresh.tsx) — two independent count implementations is
-- exactly how the 94/86 split was born. Active =
--   deleted_at IS NULL AND is_archived = FALSE
--   AND status key NOT IN ('closed', 'on_hold')
-- (a NULL status_id still counts as active — it is neither closed nor frozen).
-- 'stuck' remains active on purpose: it needs attention, it is not done.
--
-- SECURITY INVOKER on both so RLS keeps the counts per-user scoped, exactly as
-- before. Idempotent (CREATE OR REPLACE). Deps: 003 (case_statuses), 006
-- (cases), 145 (previous bootstrap body — restated below with only the
-- v_active_count line changed).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.count_active_cases()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.cases c
  LEFT JOIN public.case_statuses s ON s.id = c.status_id
  WHERE c.deleted_at IS NULL
    AND c.is_archived = FALSE
    AND COALESCE(s.key, '') NOT IN ('closed', 'on_hold');
$$;

REVOKE ALL ON FUNCTION public.count_active_cases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_active_cases() TO authenticated;

COMMENT ON FUNCTION public.count_active_cases() IS
  'Canonical dashboard "active cases" count: non-deleted, non-archived, and '
  'not in a closed/on_hold status. RLS-scoped (SECURITY INVOKER). Used by '
  'cases_dashboard_bootstrap and the dashboard realtime fingerprint. See '
  'migration 223.';

-- Restate the bootstrap (migration 145 body); only v_active_count changed —
-- it now delegates to count_active_cases() above.
CREATE OR REPLACE FUNCTION public.cases_dashboard_bootstrap()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_profile JSONB := NULL;
  v_status_options JSONB := '[]'::jsonb;
  v_bank_options JSONB := '[]'::jsonb;
  v_advisor_options JSONB := '[]'::jsonb;
  v_active_count INT := 0;
  v_archived_count INT := 0;
  v_leads_count INT := 0;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT jsonb_build_object(
    'first_name', p.first_name,
    'last_name', p.last_name
  )
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = v_actor;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name_he', s.name_he,
        'color', s.color,
        'sort_order', s.sort_order
      )
      ORDER BY s.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_status_options
    FROM public.case_statuses s
   WHERE s.is_active = TRUE;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'key', b.key,
        'name_he', b.name_he,
        'color', b.color,
        'logo_url', b.logo_url
      )
      ORDER BY b.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_bank_options
    FROM public.banks b
   WHERE b.is_active = TRUE;

  -- Identity-only, RLS-independent (SECURITY DEFINER): a view_all_cases holder
  -- who is not an admin still needs the full advisor list to read + filter by
  -- the responsible advisor.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'first_name', a.first_name,
        'last_name', a.last_name
      )
      ORDER BY a.first_name, a.last_name
    ),
    '[]'::jsonb
  )
    INTO v_advisor_options
    FROM public.list_active_advisors() a;

  -- Migration 223: "active" now excludes closed/on_hold — the one canonical
  -- definition lives in count_active_cases().
  v_active_count := public.count_active_cases();

  SELECT COUNT(*) INTO v_archived_count
    FROM public.cases c
   WHERE c.deleted_at IS NULL
     AND c.is_archived = TRUE;

  SELECT COUNT(*) INTO v_leads_count
    FROM public.leads l
   WHERE l.deleted_at IS NULL
     AND l.status <> 'converted';

  RETURN jsonb_build_object(
    'authenticated', TRUE,
    'profile', v_profile,
    'status_options', v_status_options,
    'bank_options', v_bank_options,
    'advisor_options', v_advisor_options,
    'counts', jsonb_build_object(
      'active', v_active_count,
      'archived', v_archived_count
    ),
    'leads_count', v_leads_count,
    'can_view_all', public.has_permission('view_all_cases')
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.cases_dashboard_bootstrap() TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (223) ON CONFLICT DO NOTHING;
