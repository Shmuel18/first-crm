-- =============================================================================
-- Migration 077: case lifecycle RPCs
-- =============================================================================
-- Replaces app-side service-role bypasses for the recycle-bin lifecycle with
-- narrow SECURITY DEFINER functions that enforce permission + scope in DB.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_case(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission('delete_case') THEN
    RAISE EXCEPTION 'missing delete_case permission' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.cases c
     WHERE c.id = p_case_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = v_actor)
       )
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.cases
     SET deleted_at = now(),
         updated_by = v_actor
   WHERE id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.restore_case(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.cases
     SET deleted_at = NULL,
         updated_by = v_actor
   WHERE id = p_case_id
     AND deleted_at IS NOT NULL;

  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.permanently_delete_case(
  p_case_id UUID,
  p_confirm_case_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_case_number TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT c.case_number INTO v_case_number
    FROM public.cases c
   WHERE c.id = p_case_id
     AND c.deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF btrim(v_case_number) <> btrim(COALESCE(p_confirm_case_number, '')) THEN
    RAISE EXCEPTION 'case_number mismatch' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.cases
   WHERE id = p_case_id
     AND deleted_at IS NOT NULL;

  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.list_deleted_cases(p_cutoff TIMESTAMPTZ)
RETURNS TABLE (
  id UUID,
  case_number TEXT,
  deleted_at TIMESTAMPTZ,
  status_name_he TEXT,
  status_name_en TEXT,
  status_color TEXT,
  primary_borrower_first_name TEXT,
  primary_borrower_last_name TEXT,
  assigned_advisor_first_name TEXT,
  assigned_advisor_last_name TEXT,
  deleted_by_first_name TEXT,
  deleted_by_last_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    c.id,
    c.case_number,
    c.deleted_at,
    cs.name_he AS status_name_he,
    cs.name_en AS status_name_en,
    cs.color AS status_color,
    pb.first_name AS primary_borrower_first_name,
    pb.last_name AS primary_borrower_last_name,
    advisor.first_name AS assigned_advisor_first_name,
    advisor.last_name AS assigned_advisor_last_name,
    deleter.first_name AS deleted_by_first_name,
    deleter.last_name AS deleted_by_last_name
  FROM public.cases c
  LEFT JOIN public.case_statuses cs ON cs.id = c.status_id
  LEFT JOIN public.profiles advisor ON advisor.id = c.assigned_advisor_id
  LEFT JOIN public.case_borrowers cb
    ON cb.case_id = c.id
   AND cb.is_primary = TRUE
  LEFT JOIN public.borrowers pb ON pb.id = cb.borrower_id
  LEFT JOIN LATERAL (
    SELECT al.user_id
      FROM public.audit_log al
     WHERE al.table_name = 'cases'
       AND al.action = 'SOFT_DELETE'
       AND al.record_id = c.id::text
     ORDER BY al.timestamp DESC
     LIMIT 1
  ) latest_delete ON TRUE
  LEFT JOIN public.profiles deleter ON deleter.id = latest_delete.user_id
  WHERE public.is_admin()
    AND c.deleted_at IS NOT NULL
    AND c.deleted_at >= p_cutoff
  ORDER BY c.deleted_at DESC;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_case(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_case(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.permanently_delete_case(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_deleted_cases(TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.soft_delete_case(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_case(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_case(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_deleted_cases(TIMESTAMPTZ) TO authenticated;
