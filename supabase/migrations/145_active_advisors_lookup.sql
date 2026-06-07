-- =============================================================================
-- Migration 145: identity-only advisor lookup so non-admins can see WHO the
-- responsible advisor is (dashboard column/filter + case page)
-- =============================================================================
-- BUG: a secretary (or senior advisor) with view_all_cases sees every case but
-- NOT the assigned advisor's name — on the dashboard AND the case page. Root
-- cause is the profiles RLS (migration 011):
--     profiles_select_self_or_admin: USING (id = auth.uid() OR is_admin())
-- A non-admin can read only their OWN profile, so:
--   * the cases→assigned_advisor:profiles embed resolves to NULL for any case
--     not assigned to them (dashboard name + mobile card), and
--   * the advisor options list (bootstrap + listAdvisorOptions) returns only
--     themselves, so the case-page advisor field can't map the id to a name.
--
-- We do NOT broaden the profiles RLS: that table also holds
-- google_calendar_refresh_token (a credential, encrypted at the app layer) plus
-- email / phone / metadata, and RLS can't restrict columns — widening row read
-- would leak those to colleagues (and to the raw anon key). Instead, expose ONLY
-- the three identity columns through a SECURITY DEFINER function. Colleague
-- first/last names are not sensitive in an office CRM; credentials stay locked.
--
-- Idempotent (CREATE OR REPLACE). Dependencies: 002 (profiles), 090 (bootstrap),
-- 105 (profiles.deleted_at).
-- =============================================================================

-- Identity-only advisor directory. SECURITY DEFINER so it bypasses the
-- self-or-admin profiles RLS, but returns NO sensitive columns (no email /
-- phone / role / calendar token). Active, non-deleted members only — the same
-- set the assignment dropdown already offers.
CREATE OR REPLACE FUNCTION public.list_active_advisors()
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE p.is_active = TRUE
    AND p.deleted_at IS NULL
  ORDER BY p.first_name, p.last_name;
$$;

REVOKE ALL ON FUNCTION public.list_active_advisors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_advisors() TO authenticated;

-- Re-state the dashboard bootstrap (migration 090) so its advisor_options come
-- from the identity lookup above instead of a direct, RLS-limited profiles read.
-- Everything else is byte-for-byte the migration-090 body — only the
-- v_advisor_options block changed.
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

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (145) ON CONFLICT DO NOTHING;
