-- =============================================================================
-- Migration 236: free-form scheduled questions ("עדכן אותי כל יום ב-14 כמה...")
-- =============================================================================
-- Generalizes the fixed daily digest (mig 235): a user can schedule ANY
-- question the assistant's router can translate. The question is translated
-- ONCE at subscription time — under the user's LIVE session — and the
-- resolved, deterministic form (dashboard filter params / a target case id)
-- is snapshotted here. The hourly cron re-executes only the deterministic
-- form, scoped to the user's responsibility; no free-text ever runs headless
-- and no RLS is re-implemented.
--
-- Multiple rows per user (a digest at 8 AND an email count at 14). The fixed
-- daily digest keeps its own table (235) — different lifecycle, one per user.
-- =============================================================================

CREATE TABLE public.ai_scheduled_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The question as the user phrased it (shown back in the delivery).
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 300),
  -- The router's resolved form, snapshotted at subscription time:
  --   { kind: 'portfolio', params: {view,stage,advisor,bank,targetDate,q} }
  --   { kind: 'case', caseId: uuid }
  -- Executed deterministically at fire time; shape owned by the TS layer.
  resolved JSONB NOT NULL,
  -- Israel wall-clock hour (the cron converts UTC → Asia/Jerusalem).
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Israel calendar date of the last delivery — the once-a-day claim.
  last_sent_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_scheduled_questions_user ON public.ai_scheduled_questions(user_id);

ALTER TABLE public.ai_scheduled_questions ENABLE ROW LEVEL SECURITY;

-- Self-manage; the cron runs through the service role (bypasses RLS).
CREATE POLICY ai_sched_q_select_own ON public.ai_scheduled_questions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY ai_sched_q_insert_own ON public.ai_scheduled_questions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_sched_q_update_own ON public.ai_scheduled_questions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_sched_q_delete_own ON public.ai_scheduled_questions
  FOR DELETE USING (user_id = auth.uid());

-- Include in disaster-recovery backup/restore (mirrors BACKUP_TABLES).
-- Recreates restore_backup_snapshot (mig 235 body) with ai_scheduled_questions
-- added after ai_digest_subscriptions (FK target: profiles, restored earlier).
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
