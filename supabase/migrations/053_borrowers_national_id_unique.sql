-- =============================================================================
-- Migration 053: Unique national_id on borrowers + dedup in convert_lead_to_case
-- =============================================================================
-- Borrowers table has only a non-unique index on national_id, so two cases
-- can each create a separate borrower row for the same person. The
-- "returning client autofill" lookup then becomes a coin flip, and the
-- convert_lead_to_case RPC (migration 031) always INSERTs a fresh borrower
-- even when one already exists with the same national_id. Compounding
-- duplicate-PII corruption.
--
-- BEFORE APPLYING — run this and clean up any duplicates first:
--
--   SELECT national_id, COUNT(*) AS n
--     FROM public.borrowers
--    WHERE national_id IS NOT NULL AND deleted_at IS NULL
--    GROUP BY national_id
--   HAVING COUNT(*) > 1;
--
-- For each duplicate set, you have two options:
--   (a) Merge the rows: pick a "canonical" row, repoint case_borrowers from
--       the duplicates to it via UPDATE case_borrowers SET borrower_id =
--       <canonical> WHERE borrower_id IN (...), then soft-delete the
--       duplicates.
--   (b) Keep them separate by setting national_id = NULL on all but one
--       (only acceptable for true unique-per-case scenarios).
--
-- Applying this migration on a table with duplicates WILL FAIL.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowers_national_id
  ON public.borrowers(national_id)
  WHERE national_id IS NOT NULL AND deleted_at IS NULL;

-- Update convert_lead_to_case to reuse an existing borrower (matched by
-- national_id) instead of inserting a fresh one each time. Idempotent —
-- a re-conversion of the same lead doesn't create a duplicate.
-- (Original definition from migration 031 + status guard from migration 033.)
CREATE OR REPLACE FUNCTION public.convert_lead_to_case(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_case_id UUID;
  v_borrower_id UUID;
  v_actor UUID := auth.uid();
  v_existing_status TEXT;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % not found', p_lead_id;
  END IF;

  -- Migration 033 added a status guard — only "active" leads can convert.
  v_existing_status := v_lead.status;
  IF v_existing_status IS NOT NULL AND v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % is not active (status=%)',
      p_lead_id, v_existing_status;
  END IF;

  -- Reuse the borrower if one already exists with the same national_id.
  -- Skip the lookup when national_id is NULL (lead came in without one).
  IF v_lead.national_id IS NOT NULL THEN
    SELECT id INTO v_borrower_id
      FROM public.borrowers
     WHERE national_id = v_lead.national_id
       AND deleted_at IS NULL
     LIMIT 1;
  END IF;

  IF v_borrower_id IS NULL THEN
    INSERT INTO public.borrowers (
      first_name, last_name, national_id, phone, email, created_by, updated_by
    ) VALUES (
      v_lead.first_name, v_lead.last_name, v_lead.national_id,
      v_lead.phone, v_lead.email, v_actor, v_actor
    )
    RETURNING id INTO v_borrower_id;
  END IF;

  INSERT INTO public.cases (
    primary_borrower_id, status_id, created_by, updated_by
  )
  SELECT
    v_borrower_id,
    (SELECT id FROM public.case_statuses WHERE key = 'lead' LIMIT 1),
    v_actor,
    v_actor
  RETURNING id INTO v_case_id;

  INSERT INTO public.case_borrowers (case_id, borrower_id, is_primary)
  VALUES (v_case_id, v_borrower_id, TRUE)
  ON CONFLICT (case_id, borrower_id) DO NOTHING;

  UPDATE public.leads
     SET status = 'converted',
         converted_case_id = v_case_id,
         updated_by = v_actor
   WHERE id = p_lead_id;

  RETURN v_case_id;
END;
$$;
