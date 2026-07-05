-- =============================================================================
-- Migration 213: time_entries — employee attendance clock (Phase-2 feature F: time tracking)
-- =============================================================================
-- Hourly staff (the secretary + a temp worker) punch IN / OUT; the manager sees
-- who is currently at work and a per-employee timesheet, and is the ONLY one who
-- can edit/correct/delete entries.
--
-- Model: one row per shift. clock_out NULL = still clocked in. "Who's in now" is
-- just the rows with clock_out NULL. A partial UNIQUE index enforces at most one
-- OPEN shift per user (no accidental double clock-in).
--
-- Access model (deliberately NOT a new permission — mirrors the /statistics and
-- /maaser manager-only precedent):
--   * profiles.time_tracked = TRUE  -> this person is an hourly employee: they
--     see their own clock, appear in the manager board, and (Phase 2) get the
--     "forgot to clock out" reminder. The manager flips this per person.
--   * RLS: an employee reads/writes only their OWN rows and can only CLOSE their
--     own currently-open shift; the manager (is_admin()) reads/edits ALL.
--   * profiles.auto_clock_in = TRUE -> (Phase 2) auto-punch-in on login.
--
-- A locked-down "employee" role is seeded so the manager can invite a temp worker
-- who sees ONLY the clock (no CRM permissions granted to it).
--
-- Durable payroll data -> included in backup/restore (BACKUP_TABLES + v_tables
-- below; enforced by backup-restore-allowlist.test).
-- Dependencies: 002 (profiles, roles, is_admin), set_updated_at trigger fn.
-- =============================================================================

-- ---- Per-employee flags on profiles -----------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS time_tracked  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_clock_in BOOLEAN NOT NULL DEFAULT FALSE;

-- ---- Locked-down "employee" role (no permissions granted -> sees only clock) --
INSERT INTO public.roles (key, name_he, name_en, sort_order, is_active, is_system)
VALUES ('employee', 'עובד', 'Employee', 50, TRUE, TRUE)
ON CONFLICT (key) DO NOTHING;

-- ---- The clock table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clock_in    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out   TIMESTAMPTZ,
  note        TEXT,
  -- 'manual' = a real button press / manager entry; 'auto' = auto punch-in on
  -- login (Phase 2). Kept so the manager can tell them apart.
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES public.profiles(id),
  CONSTRAINT time_entries_out_after_in CHECK (clock_out IS NULL OR clock_out >= clock_in)
);

-- At most one OPEN shift per user (blocks double clock-in at the DB level).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_time_entries_one_open
  ON public.time_entries(user_id)
  WHERE clock_out IS NULL AND deleted_at IS NULL;

-- Timesheet reads: a user's shifts newest-first.
CREATE INDEX IF NOT EXISTS idx_time_entries_user_in
  ON public.time_entries(user_id, clock_in DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Employee reads own; manager reads all.
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.is_admin()));

-- Employee punches IN for themselves; manager can insert for anyone.
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND (user_id = auth.uid() OR public.is_admin()));

-- Employee may only CLOSE their own currently-open shift (clock_out was NULL);
-- once closed, only the manager can edit. Manager edits anything.
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND clock_out IS NULL AND deleted_at IS NULL)
  )
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- No DELETE policy: soft-delete only, manager only, via the RPC below.
CREATE OR REPLACE FUNCTION public.soft_delete_time_entry(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.time_entries
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_time_entry(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_time_entry(UUID) TO authenticated;

COMMENT ON TABLE public.time_entries IS
  'Employee attendance clock (one row per shift; clock_out NULL = on the clock). '
  'Employee reads/closes own; manager (is_admin) edits all. Soft-delete via RPC. '
  'See migration 213.';

-- -----------------------------------------------------------------------------
-- Include time_entries in disaster-recovery backup/restore. Re-creates the
-- restore RPC (latest body from migration 206) with time_entries added to
-- v_tables (after case_payouts/maaser — it only FKs profiles, restored early)
-- and to the deleted_at strip (it soft-deletes). The TS BACKUP_TABLES gets the
-- matching entry in the same change; backup-restore-allowlist.test enforces parity.
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
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts', 'maaser_payments',
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
    'case_properties', 'case_payouts', 'maaser_payments', 'time_entries', 'message_templates'
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

INSERT INTO public.schema_version (version) VALUES (213) ON CONFLICT DO NOTHING;
