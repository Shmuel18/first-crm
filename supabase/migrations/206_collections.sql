-- =============================================================================
-- Migration 206: collections module — fee-payment ledger + permissions
-- =============================================================================
-- The office tracks fee income (שכר טרחה) as a single agreed amount
-- (case_financials.fee_amount) plus a binary "paid" flag. The collections
-- module replaces that binary with a real LEDGER of partial payments received
-- against the agreed fee: how much, when, how (payment method), and which
-- "part" (a free-text installment label — מקדמה / תשלום 1 / יתרה).
--
-- Office-side EXPENSES already live in case_expenses (migration 081) and feed
-- the per-case profit figure — the collections feature only reads them.
--
-- ACCESS — a NEW granular pair, NOT is_admin(): the owner wants to appoint a
-- "ממונה גבייה" (collections officer) without making them an admin.
--   view_collections   — see the module (global page + case block, read)
--   manage_collections — add / edit / delete payments (write)
-- The admin role auto-receives both via the migration-169 grant trigger, so the
-- manager always has them; any other role/user gets them through the existing
-- roles editor + per-user overrides. Both are category 'financial' so they sit
-- with view_case_fee in the editor.
--
-- Dependencies: 002 (has_permission, set_updated_at), 081 (case_expenses),
-- 025 (case_financials), 169 (admin auto-grant trigger), 204 (latest
-- restore_backup_snapshot body — recreated here with case_fee_payments added).
-- =============================================================================

-- ---- Permissions -------------------------------------------------------------
INSERT INTO public.permissions (key, name_he, name_en, category) VALUES
  ('view_collections',   'לראות גבייה',  'View Collections',   'financial'),
  ('manage_collections', 'לנהל גבייה',   'Manage Collections', 'financial')
ON CONFLICT (key) DO UPDATE
  SET name_he = EXCLUDED.name_he,
      name_en = EXCLUDED.name_en,
      category = EXCLUDED.category;
-- Admin gets both automatically (trg_grant_new_permission_to_admin, mig 169).

-- ---- Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_fee_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  paid_on         DATE,
  amount          NUMERIC(15, 2) CHECK (amount > 0),
  -- "how paid" — closed enum, mirrored 1:1 in the TS PAYMENT_METHODS const.
  payment_method  TEXT CHECK (payment_method IN (
                    'cash', 'bank_transfer', 'check', 'credit_card', 'bit', 'other'
                  )),
  -- "which part" — free-text installment label (מקדמה / תשלום 1 / יתרה).
  label           TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES public.profiles(id),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES public.profiles(id)
);

-- Empty table at creation → a plain index is fine (no CONCURRENTLY needed, and
-- this migration runs in a transaction so CONCURRENTLY would error anyway).
CREATE INDEX IF NOT EXISTS idx_case_fee_payments_case
  ON public.case_fee_payments(case_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_case_fee_payments_updated_at
  BEFORE UPDATE ON public.case_fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.case_fee_payments ENABLE ROW LEVEL SECURITY;

-- SELECT — anyone holding view_collections (the parent case must still exist).
DROP POLICY IF EXISTS "case_fee_payments_select" ON public.case_fee_payments;
CREATE POLICY "case_fee_payments_select" ON public.case_fee_payments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('view_collections')
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_fee_payments.case_id
         AND c.deleted_at IS NULL
    )
  );

-- INSERT — manage_collections, onto a live case.
DROP POLICY IF EXISTS "case_fee_payments_insert" ON public.case_fee_payments;
CREATE POLICY "case_fee_payments_insert" ON public.case_fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND public.has_permission('manage_collections')
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_fee_payments.case_id
         AND c.deleted_at IS NULL
    )
  );

-- UPDATE — manage_collections on both sides (inline-edit cells + soft-delete RPC).
DROP POLICY IF EXISTS "case_fee_payments_update" ON public.case_fee_payments;
CREATE POLICY "case_fee_payments_update" ON public.case_fee_payments
  FOR UPDATE TO authenticated
  USING (public.has_permission('manage_collections'))
  WITH CHECK (public.has_permission('manage_collections'));

-- No DELETE policy — soft-delete only, via the RPC below.

-- ---- Soft-delete RPC ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_fee_payment(
  p_case_id    UUID,
  p_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission('manage_collections') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.case_fee_payments
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_payment_id
     AND case_id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_fee_payment(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_fee_payment(UUID, UUID) TO authenticated;

-- ---- Global overview RPC -----------------------------------------------------
-- Per-case aggregates for the global /collections dashboard. SECURITY DEFINER
-- so a collections officer (view_collections but NOT view_case_fee) can still
-- see the agreed fee in AGGREGATE form here — without that, the case_financials
-- RLS would null the fee out. The function gates on view_collections itself, so
-- it never widens access beyond the permission. Only non-archived, non-deleted
-- cases are reported.
CREATE OR REPLACE FUNCTION public.collections_overview()
RETURNS TABLE (
  case_id            UUID,
  case_number        TEXT,
  assigned_advisor_id UUID,
  fee_amount         NUMERIC,
  collected          NUMERIC,
  expenses           NUMERIC,
  payment_count      BIGINT,
  last_payment_on    DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('view_collections') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.case_number,
    c.assigned_advisor_id,
    cf.fee_amount,
    COALESCE(p.collected, 0)::numeric,
    COALESCE(e.expenses, 0)::numeric,
    COALESCE(p.payment_count, 0)::bigint,
    p.last_payment_on
  FROM public.cases c
  LEFT JOIN public.case_financials cf ON cf.case_id = c.id
  LEFT JOIN (
    SELECT case_id,
           SUM(amount)            AS collected,
           COUNT(*)               AS payment_count,
           MAX(paid_on)           AS last_payment_on
      FROM public.case_fee_payments
     WHERE deleted_at IS NULL
     GROUP BY case_id
  ) p ON p.case_id = c.id
  LEFT JOIN (
    SELECT case_id, SUM(amount) AS expenses
      FROM public.case_expenses
     WHERE deleted_at IS NULL
     GROUP BY case_id
  ) e ON e.case_id = c.id
  WHERE c.deleted_at IS NULL
    AND c.is_archived = FALSE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.collections_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collections_overview() TO authenticated;

COMMENT ON TABLE public.case_fee_payments IS
  'Ledger of partial fee payments received against case_financials.fee_amount. '
  'view/manage_collections RLS, soft-delete. See migration 206.';

-- -----------------------------------------------------------------------------
-- Disaster-recovery: include case_fee_payments in backup/restore. Recreates the
-- migration-204 restore_backup_snapshot body verbatim with case_fee_payments
-- added to v_tables (after case_expenses — it only FKs cases + profiles, both
-- restored earlier) and to the deleted_at strip (it soft-deletes). The TS
-- backup writer (BACKUP_TABLES) gets the matching entry in the same change.
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
    'role_permissions', 'user_permission_overrides', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'case_expenses', 'case_fee_payments',
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts', 'maaser_payments', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'case_fee_payments', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'message_templates'
  ];
  v_tbl text;
  v_rows jsonb;
  v_inserted bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
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

INSERT INTO public.schema_version (version) VALUES (206) ON CONFLICT DO NOTHING;
