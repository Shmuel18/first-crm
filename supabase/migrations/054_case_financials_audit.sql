-- =============================================================================
-- Migration 054: Fix case_financials audit trail
-- =============================================================================
-- The audit_log_change trigger (migration 012/045) references NEW.id to
-- build the record_id reference. case_financials has no `id` column (its
-- PK is case_id), so the generic trigger can't attach there cleanly. The
-- 045 fallback handles some cases by sniffing the row JSONB, but
-- case_financials writes either throw or skip the audit — losing the
-- change history for the single most sensitive table (fee_amount,
-- expected_income are manager-only).
--
-- Fix: dedicated trigger for case_financials that uses case_id as the
-- audit record_id. Each fee/expected-income change now produces an
-- audit_log row pointing at the case it belongs to, which is the natural
-- forensic anchor anyway ("show me the fee history for case X").
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_case_financials_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_record_id UUID;
  v_changed JSONB;
  v_old JSONB;
  v_new JSONB;
  v_actor UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_record_id := NEW.case_id;
    v_changed := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_record_id := NEW.case_id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Diff: keep only keys whose values changed
    SELECT jsonb_object_agg(key, jsonb_build_object('from', v_old->key, 'to', v_new->key))
      INTO v_changed
      FROM jsonb_object_keys(v_new) AS key
     WHERE v_old->key IS DISTINCT FROM v_new->key;
    -- No-op update — skip the audit row.
    IF v_changed IS NULL OR v_changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_record_id := OLD.case_id;
    v_changed := to_jsonb(OLD);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_actor := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.system_actor', true), '')::uuid
  );

  INSERT INTO public.audit_log (
    user_id, action, table_name, record_id, changed_fields,
    ip_address, user_agent, timestamp
  ) VALUES (
    v_actor,
    v_action,
    'case_financials',
    v_record_id,
    v_changed,
    NULLIF(current_setting('app.ip_address', true), ''),
    NULLIF(current_setting('app.user_agent', true), ''),
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Replace any generic audit trigger on case_financials with the dedicated one.
DROP TRIGGER IF EXISTS trg_audit_case_financials ON public.case_financials;
CREATE TRIGGER trg_audit_case_financials
  AFTER INSERT OR UPDATE OR DELETE ON public.case_financials
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_case_financials_change();
