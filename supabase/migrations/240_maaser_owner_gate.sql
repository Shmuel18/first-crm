-- =============================================================================
-- Migration 240: is_maaser_owner() — the tithe ledger leaves the admin gate
-- =============================================================================
-- The office is getting a second manager (admin role): everything a manager can
-- do, EXCEPT the ma'aser ledger, which is the owner's personal charity record
-- and not office data. Until now /maaser was gated on is_admin() (migs 204,
-- 220, 221), so a second admin would see it.
--
-- The gate becomes a profiles flag rather than a permission key on purpose:
-- an admin can manage roles and per-user overrides, so a permission-based
-- fence could be lifted by the very person it excludes. `is_maaser_owner` has
-- no UI and is set only here / by SQL.
--
-- Nothing else moves. Statistics, collections, settings, backup, payouts —
-- all stay on is_admin() and open up to the new manager as intended.
--
-- Dependencies: 002 (profiles, is_admin), 204, 220, 221.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_maaser_owner BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_maaser_owner IS
  'Office owner: the only user who may see/edit the ma''aser ledger. No UI — '
  'set by SQL only, so a second admin cannot grant it to themselves. Mig 240.';

CREATE OR REPLACE FUNCTION public.is_maaser_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.is_active = TRUE
       AND p.is_maaser_owner
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_maaser_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_maaser_owner() TO authenticated;

-- Seed: the sole existing admin is the owner. Written so it is a no-op if the
-- office already has more than one admin when this runs (then set it by hand).
UPDATE public.profiles p
   SET is_maaser_owner = TRUE
 WHERE p.id = (
   SELECT p2.id FROM public.profiles p2
     JOIN public.roles r ON r.id = p2.role_id
    WHERE r.key = 'admin' AND p2.is_active
    LIMIT 1
 )
   AND (SELECT COUNT(*) FROM public.profiles p3
          JOIN public.roles r3 ON r3.id = p3.role_id
         WHERE r3.key = 'admin' AND p3.is_active) = 1
   AND NOT EXISTS (SELECT 1 FROM public.profiles p4 WHERE p4.is_maaser_owner);

-- -----------------------------------------------------------------------------
-- Re-gate: maaser_payments (204)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "maaser_payments_select" ON public.maaser_payments;
CREATE POLICY "maaser_payments_select" ON public.maaser_payments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_maaser_owner());

DROP POLICY IF EXISTS "maaser_payments_insert" ON public.maaser_payments;
CREATE POLICY "maaser_payments_insert" ON public.maaser_payments
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND public.is_maaser_owner());

DROP POLICY IF EXISTS "maaser_payments_update" ON public.maaser_payments;
CREATE POLICY "maaser_payments_update" ON public.maaser_payments
  FOR UPDATE TO authenticated
  USING (public.is_maaser_owner())
  WITH CHECK (public.is_maaser_owner());

CREATE OR REPLACE FUNCTION public.soft_delete_maaser_payment(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_maaser_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.maaser_payments
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

COMMENT ON TABLE public.maaser_payments IS
  'Owner-only charity/tithe ledger. Donations netted against the 10%/20% of '
  'NET-fee obligation in the app. is_maaser_owner() RLS (mig 240), soft-delete.';

-- -----------------------------------------------------------------------------
-- Re-gate: maaser_ledger_entries (220)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "maaser_ledger_entries_select" ON public.maaser_ledger_entries;
CREATE POLICY "maaser_ledger_entries_select" ON public.maaser_ledger_entries
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_maaser_owner());

DROP POLICY IF EXISTS "maaser_ledger_entries_insert" ON public.maaser_ledger_entries;
CREATE POLICY "maaser_ledger_entries_insert" ON public.maaser_ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND public.is_maaser_owner());

DROP POLICY IF EXISTS "maaser_ledger_entries_update" ON public.maaser_ledger_entries;
CREATE POLICY "maaser_ledger_entries_update" ON public.maaser_ledger_entries
  FOR UPDATE TO authenticated
  USING (public.is_maaser_owner())
  WITH CHECK (public.is_maaser_owner());

CREATE OR REPLACE FUNCTION public.soft_delete_maaser_entry(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_maaser_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.maaser_ledger_entries
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

COMMENT ON TABLE public.maaser_ledger_entries IS
  'Owner-only ma''aser ledger: manual adjustments to the tithe base. '
  'is_maaser_owner() RLS (mig 240), soft-delete.';

-- -----------------------------------------------------------------------------
-- Re-gate: maaser_income_basis() (221) — body unchanged, gate swapped.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maaser_income_basis()
RETURNS TABLE (fee_collected NUMERIC, commissions NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_maaser_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(pc.fee), 0)::numeric,
    COALESCE(SUM(LEAST(pc.payouts, pc.fee)), 0)::numeric
  FROM (
    SELECT
      GREATEST(
        COALESCE((
          SELECT SUM(p.amount) FROM public.case_fee_payments p
           WHERE p.case_id = cs.id AND p.deleted_at IS NULL
        ), 0)
        - COALESCE((
          SELECT SUM(e.amount) FROM public.case_expenses e
           WHERE e.case_id = cs.id AND e.deleted_at IS NULL
        ), 0),
        0
      ) AS fee,
      COALESCE((
        SELECT SUM(o.amount) FROM public.case_payouts o
         WHERE o.case_id = cs.id AND o.deleted_at IS NULL
      ), 0) AS payouts
    FROM public.cases cs
  ) pc;
END;
$fn$;


-- -----------------------------------------------------------------------------
-- Re-gate: restore_backup_snapshot() — OWNER-only, not every admin.
-- -----------------------------------------------------------------------------
-- A backup snapshot contains the ma'aser tables (they are durable financial
-- data and must stay restorable), so backup/restore is a back door around the
-- fence above: a second admin could run a backup, download the file and read
-- the owner's ledger out of it. Backup + restore therefore move to the owner
-- too. The nightly cron is unaffected — it runs service-role, with no
-- auth.uid(), and never goes through this RPC.
--
-- Migration-238 body verbatim, is_admin() -> is_maaser_owner() in the gate.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'roles', 'permissions', 'banks', 'case_bank_statuses', 'case_statuses', 'case_types',
    'document_categories', 'income_types', 'holidays', 'profiles', 'office_settings',
    'role_permissions', 'user_permission_overrides', 'ai_digest_subscriptions', 'ai_scheduled_questions', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'document_classifications', 'case_expenses', 'case_fee_payments',
    'case_agreements',
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts',
    'maaser_payments', 'maaser_ledger_entries',
    'time_entries', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'case_fee_payments', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'maaser_ledger_entries', 'time_entries', 'message_templates'
  ];
  v_tbl text;
  v_rows jsonb;
  v_inserted bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_maaser_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF COALESCE((p_snapshot->>'version')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'unsupported backup version' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.restoring_backup', 'true', true);

  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_rows := p_snapshot->'data'->v_tbl;
    IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      v_result := v_result || jsonb_build_object(v_tbl, 0);
      CONTINUE;
    END IF;

    IF v_tbl = ANY(v_tables_with_deleted_at) THEN
      SELECT jsonb_agg(elem - 'deleted_at') INTO v_rows
        FROM jsonb_array_elements(v_rows) AS elem;
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
      v_tbl, v_tbl
    ) USING v_rows;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_result := v_result || jsonb_build_object(v_tbl, v_inserted);
  END LOOP;

  PERFORM set_config('app.restoring_backup', 'false', true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(jsonb) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (240) ON CONFLICT DO NOTHING;
