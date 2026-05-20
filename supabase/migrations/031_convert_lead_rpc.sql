-- Convert a lead into a case, atomically.
--
-- Creates a borrower from the lead's details, a case (status = case_opened)
-- with that borrower as primary, links them, and marks the lead converted —
-- all in one transaction so a partial conversion can never happen.
--
-- Security: SECURITY DEFINER (owner = postgres) so it can write across tables,
-- gated on has_permission('create_case'). Converting is creating a case.

CREATE OR REPLACE FUNCTION public.convert_lead_to_case(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads;
  v_uid uuid := auth.uid();
  v_borrower_id uuid;
  v_case_id uuid;
  v_status_id uuid;
BEGIN
  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_lead.status = 'converted' THEN
    RAISE EXCEPTION 'lead already converted' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_status_id FROM public.case_statuses WHERE key = 'case_opened' LIMIT 1;

  INSERT INTO public.borrowers
    (first_name, last_name, national_id, phone, email, notes, created_by, updated_by)
  VALUES
    (v_lead.first_name, v_lead.last_name, v_lead.national_id, v_lead.phone, v_lead.email,
     v_lead.notes, v_uid, v_uid)
  RETURNING id INTO v_borrower_id;

  INSERT INTO public.cases
    (status_id, assigned_advisor_id, primary_borrower_id, created_by, updated_by)
  VALUES
    (v_status_id, COALESCE(v_lead.assigned_to, v_uid), v_borrower_id, v_uid, v_uid)
  RETURNING id INTO v_case_id;

  INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
  VALUES (v_case_id, v_borrower_id, 'borrower', TRUE);

  UPDATE public.leads
    SET status = 'converted',
        converted_at = NOW(),
        converted_to_case_id = v_case_id,
        updated_by = v_uid
    WHERE id = p_lead_id;

  RETURN v_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_case(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_case(uuid) TO authenticated;
