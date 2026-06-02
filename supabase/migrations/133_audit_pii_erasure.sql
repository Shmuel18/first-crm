-- =============================================================================
-- Migration 133: Right-to-erasure — redact PII from audit_log on hard delete
-- =============================================================================
-- PRIV-1. audit_log.changed_fields keeps the full row payload (national_id,
-- name, contact, financials) for the retention window (~365d — migrations
-- 049/063). When an entity is PERMANENTLY deleted — the cleanup cron hard-
-- deletes soft-deleted rows at ~14d (migration 012/022), or
-- permanently_delete_case (077) and its FK cascades — the row is gone from the
-- app but its PII lingers in audit for the remaining ~350d. That conflicts
-- with the data subject's right to erasure (Israeli Privacy Protection Law).
--
-- Fix: when an audited entity is HARD-deleted, redact the changed_fields
-- payload of ALL its audit rows (history + the delete's own row) to a marker,
-- KEEPING the forensic skeleton (table_name, record_id, action, user_id,
-- timestamp, ip_address, user_agent). The trail of "who did what, when, to
-- which record" survives; the personal data does not.
--
-- Automatic via AFTER DELETE triggers (not a callable RPC) so it covers every
-- hard-delete path — the retention cron, permanently_delete_case, and any FK
-- cascade — and can never be forgotten.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend the immutability guard (049/063) with a SECOND sanctioned path.
--    audit_log stays append-only for everyone except the two blessed jobs:
--    the retention purge (app.purge_audit) and PII erasure (app.redact_audit).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_block_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.purge_audit', true), 'off') = 'on'
     OR coalesce(current_setting('app.redact_audit', true), 'off') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_log rows are immutable (operation: %)', TG_OP
    USING HINT = 'Sanctioned paths only: cleanup_old_audit_logs (purge) and audit_redact_on_hard_delete (PII erasure).';
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Redaction trigger function. Resolves the audit record_id the SAME way the
--    audit writer does (migration 045: COALESCE(id, case_id)) so it always
--    matches the rows that trigger wrote — no per-table column argument needed.
--    case_financials keys on case_id; case_borrowers carries a surrogate id
--    (migration 014); every other table uses id. All covered by the COALESCE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_redact_on_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB := to_jsonb(OLD);
  v_record_id UUID;
BEGIN
  v_record_id := COALESCE(
    (v_old->>'id')::uuid,
    (v_old->>'case_id')::uuid
  );
  IF v_record_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Sanctioned audit mutation. set_config(..., is_local => true) is
  -- transaction-local; we flip it straight back to 'off' so the writable
  -- window is exactly this UPDATE and the rest of the caller's transaction
  -- (e.g. a multi-row cleanup) stays append-only between redactions.
  PERFORM set_config('app.redact_audit', 'on', true);
  UPDATE public.audit_log
     SET changed_fields = jsonb_build_object('_redacted', true)
   WHERE table_name = TG_TABLE_NAME
     AND record_id = v_record_id
     AND changed_fields IS NOT NULL
     AND NOT (changed_fields ? '_redacted');
  PERFORM set_config('app.redact_audit', 'off', true);

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_redact_on_hard_delete() FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3. Attach AFTER DELETE triggers on the client / personal-data tables.
--    Named trg_redact_audit_* so they fire AFTER trg_audit_* (PG fires row
--    triggers in name order; 'audit' < 'redact') — the delete's own audit row
--    is therefore already written and gets redacted too.
--
--    Excluded by design: the office reference tables (market_data_*,
--    purchase_tax_brackets, bank_offers, bank_offer_tracks, approval_rulesets)
--    are admin-managed system data, not personal data — nothing to erase.
-- -----------------------------------------------------------------------------
DO $attach$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'leads', 'cases', 'borrowers', 'borrower_incomes', 'borrower_obligations',
    'case_banks', 'case_borrowers', 'documents', 'tasks', 'profiles',
    'case_financials', 'mortgage_scenarios', 'scenario_tracks'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_redact_audit_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.audit_redact_on_hard_delete()',
      'trg_redact_audit_' || t, t
    );
  END LOOP;
END $attach$;
