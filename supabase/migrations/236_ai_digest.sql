-- =============================================================================
-- Migration 236: scheduled AI digests ("סכם לי כל יום בשעה 8")
-- =============================================================================
-- The assistant can now be asked for a recurring daily summary. This adds:
--   1. ai_digest_subscriptions — one row per user: enabled + Israel wall-clock
--      hour + last_sent_date (the hourly cron's idempotency claim).
--   2. notifications type CHECK re-stated with 'ai_digest' (bell delivery).
--   3. restore_backup_snapshot recreated with the new table (mirrors
--      BACKUP_TABLES — the allowlist test enforces lockstep).
--
-- The digest CONTENT is never stored here — it lives in the notification row's
-- data snapshot like every other bell kind. Feature-flagged via
-- office_settings.ai_features.modes.scheduled_digest (TS-owned key, no enum —
-- mig 232 note), fail-closed.
-- =============================================================================

-- 1) Per-user digest subscription -------------------------------------------
CREATE TABLE public.ai_digest_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Israel wall-clock hour (the cron converts UTC → Asia/Jerusalem, DST-safe).
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  -- Israel calendar date of the last delivered digest — the hourly cron's
  -- send-once-per-day claim (optimistic UPDATE ... WHERE guards races).
  last_sent_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_digest_subscriptions ENABLE ROW LEVEL SECURITY;

-- Self-manage: each user sees + edits only their own subscription. The cron
-- reads/writes through the service role (bypasses RLS).
CREATE POLICY ai_digest_select_own ON public.ai_digest_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY ai_digest_insert_own ON public.ai_digest_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_digest_update_own ON public.ai_digest_subscriptions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_digest_delete_own ON public.ai_digest_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- 2) Allow the new bell kind (re-state the FULL current set from mig 185). ---
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_completed',
    'case_status_overdue',
    'task_reminder',
    'case_mention',
    'task_mention',
    'backup_stale',
    'erasure_stale',
    'web_lead',
    'task_comment',
    'ai_digest'
  ));

-- 3) Include ai_digest_subscriptions in disaster-recovery backup/restore -----
-- (mirrors BACKUP_TABLES). Recreates restore_backup_snapshot (mig 233 body)
-- with ai_digest_subscriptions added to v_tables after profiles (its only FK
-- target). Not soft-deleted → not in the deleted_at strip.
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
    'role_permissions', 'user_permission_overrides', 'ai_digest_subscriptions', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'document_classifications', 'case_expenses', 'case_fee_payments',
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

INSERT INTO public.schema_version (version) VALUES (236) ON CONFLICT DO NOTHING;
