-- =============================================================================
-- Migration 090: Cases dashboard bootstrap RPC
-- =============================================================================
-- The /cases dashboard used to fetch profile, lookup tables, counts and the
-- view_all_cases permission through several independent Supabase requests.
-- On self-hosted deploys where the app server and Supabase are not co-located,
-- each round-trip is user-visible. This RPC keeps RLS intact (SECURITY INVOKER)
-- while collapsing the dashboard chrome data into one request.
-- =============================================================================

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

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'last_name', p.last_name
      )
      ORDER BY p.first_name, p.last_name
    ),
    '[]'::jsonb
  )
    INTO v_advisor_options
    FROM public.profiles p
   WHERE p.is_active = TRUE;

  SELECT COUNT(*) INTO v_active_count
    FROM public.cases c
   WHERE c.deleted_at IS NULL
     AND c.is_archived = FALSE;

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
