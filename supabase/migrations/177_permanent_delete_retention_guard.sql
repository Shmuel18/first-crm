-- =============================================================================
-- Migration 177: gate permanent-delete on the retention switch (R5-lifecycle-1)
--                + let the orphan log record a case-folder pointer (R5-lifecycle-2)
-- =============================================================================
-- (1) RETENTION GUARD. Migration 173 paused all AUTOMATED destructive purges via
--     office_settings.retention_purge_enabled (default FALSE) for a stated legal
--     retention hold, and its header claims "EVERY destructive path honors it".
--     But permanently_delete_case (mig 077) — the one human-initiated hard delete
--     — had no check, so an admin could irrecoverably destroy a case + its files
--     during the legal hold. Now it refuses while the switch is off, raising a
--     DEDICATED ERRCODE 'PT001' the action maps to a 'retention_paused' result.
--     service_role / direct SQL still pass (recovery), same posture as mig 173.
--
-- (2) ORPHAN-LOG CASE ENTITY. erasure_orphan_log (mig 144) only allowed
--     entity IN ('document','expense'). The manual permanent-delete file eraser
--     also needs to record a leaked CASE Drive FOLDER pointer when erasure fails,
--     so 'case' is added to the CHECK.
--
-- Body is migration-077 permanently_delete_case verbatim + the guard. Idempotent.
-- Dependencies: 077 (prior body), 173 (retention switch), 144 (orphan log).
-- =============================================================================

-- (1) retention guard on the manual permanent delete -------------------------
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
  v_role TEXT := auth.role();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Retention hold: an end-user permanent delete is refused while the master
  -- switch is off (mig 173). service_role / direct-SQL recovery still pass.
  IF v_role IN ('authenticated', 'anon') AND NOT public.retention_purge_enabled() THEN
    RAISE EXCEPTION 'permanent delete is paused by the retention hold'
      USING ERRCODE = 'PT001';
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

-- (2) allow the orphan log to record a leaked case-folder pointer -------------
ALTER TABLE public.erasure_orphan_log
  DROP CONSTRAINT IF EXISTS erasure_orphan_log_entity_check;
ALTER TABLE public.erasure_orphan_log
  ADD CONSTRAINT erasure_orphan_log_entity_check
  CHECK (entity IN ('document', 'expense', 'case'));

INSERT INTO public.schema_version (version) VALUES (177) ON CONFLICT DO NOTHING;
