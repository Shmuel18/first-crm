-- =============================================================================
-- Migration 241: is_maaser_owner() -> is_owner(), and the time clock joins it
-- =============================================================================
-- Migration 240 carved the ma'aser ledger (and, transitively, backup/restore)
-- out of the admin role for the office's new second manager. Kaufman now wants
-- the TIME CLOCK reserved too: attendance for the hourly staff, their pay rates
-- and the timesheet export stay with him.
--
-- That makes "reserved to the office owner" a general concept rather than a
-- ma'aser detail, so the flag is renamed while it is one day old and set on a
-- single row:  profiles.is_maaser_owner -> profiles.is_owner,
--              public.is_maaser_owner()  -> public.is_owner().
--
-- ALTER FUNCTION ... RENAME keeps every policy that already references the
-- function (the maaser RLS from 240) pointing at the same OID, so those
-- policies need no DDL. plpgsql bodies are stored as TEXT, though, so any
-- function that CALLS the old name — or reads the old column — must be
-- recreated below or it breaks at runtime with "function does not exist".
--
-- What moves onto the owner gate here (was is_admin(), migration 213):
--   * time_entries RLS — an employee still reads/writes their OWN shifts;
--     only the owner sees or edits everyone's.
--   * soft_delete_time_entry() — the manager-deletes-a-shift RPC.
-- What deliberately does NOT move: the nightly reminder + auto-clock-in crons
-- (service-role, no auth.uid(), never these policies) and every other admin
-- surface — statistics, collections, settings, cases.
--
-- KNOWN RESIDUAL (deliberate, not an oversight): profiles.hourly_rate is a
-- plain column on profiles, whose SELECT policy is self-or-admin (mig 011). RLS
-- is row-level, so with every time-clock surface closed the second admin can
-- still READ pay rates straight off profiles via PostgREST. Writing them is
-- closed below (section 4); hiding the read needs either column privileges
-- (REVOKE SELECT (hourly_rate) ... which breaks every select that names it,
-- so both the employee's own rate and the owner's board would have to move
-- behind SECURITY DEFINER RPCs) or a separate owner-only wage table. Bigger
-- than this change; tracked separately. audit_log has the same shape — it
-- records old/new for hourly_rate on every change and is admin-readable.
--
-- Dependencies: 002 (profiles, is_admin), 213 (time_entries), 240 (the flag).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rename the flag + the function (idempotent).
-- -----------------------------------------------------------------------------
DO $rename$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND column_name = 'is_maaser_owner'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN is_maaser_owner TO is_owner;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_maaser_owner'
  ) THEN
    ALTER FUNCTION public.is_maaser_owner() RENAME TO is_owner;
  END IF;
END
$rename$;

COMMENT ON COLUMN public.profiles.is_owner IS
  'Office owner: the one user who keeps the capabilities the admin role does '
  'NOT confer — ma''aser ledger (mig 240), backup/restore, time clock (241). '
  'No UI: set by SQL only, so a second admin cannot grant it to themselves.';

-- Body must be recreated: the rename does not rewrite the plpgsql text, which
-- still reads the pre-rename column name.
CREATE OR REPLACE FUNCTION public.is_owner()
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
       AND p.is_owner
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Re-point every function that CALLS the old name (migration 240 bodies,
--    verbatim apart from is_maaser_owner() -> is_owner()).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_maaser_payment(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.maaser_payments
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.soft_delete_maaser_entry(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.maaser_ledger_entries
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.maaser_income_basis()
RETURNS TABLE (fee_collected NUMERIC, commissions NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_owner() THEN
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
  IF NOT public.is_owner() THEN
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

-- -----------------------------------------------------------------------------
-- 3. The time clock moves onto the owner gate (was is_admin(), migration 213).
--    Employees keep full access to their OWN shifts — user_id = auth.uid() is
--    untouched; only the manager half of each policy changes.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.is_owner()));

DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND (user_id = auth.uid() OR public.is_owner()));

DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL AND (
      (user_id = auth.uid() AND clock_out IS NULL)
      OR public.is_owner()
    )
  )
  WITH CHECK (user_id = auth.uid() OR public.is_owner());

CREATE OR REPLACE FUNCTION public.soft_delete_time_entry(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.time_entries
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

COMMENT ON TABLE public.time_entries IS
  'Attendance shifts for hourly staff. Employee reads/closes their own; the '
  'office OWNER (is_owner, mig 241 — not every admin) sees and edits all. '
  'Soft-delete via RPC.';


-- -----------------------------------------------------------------------------
-- 4. Make the flag un-self-grantable.
-- -----------------------------------------------------------------------------
-- Migration 240's whole argument for a column instead of a permission key was
-- that an admin can edit roles and per-user overrides, so a permission-based
-- fence could be lifted by the person it excludes. That argument only holds if
-- the COLUMN cannot be written from the API either — and it could:
--   * profiles_update_self (mig 011) is USING (id = auth.uid()) with no column
--     restriction, and the only BEFORE UPDATE guards on profiles cover
--     role_id/is_active (022), metadata (060) and is_protected (172);
--   * profiles_admin_all (011) is FOR ALL to anyone holding manage_users.
-- So any authenticated user could PATCH /rest/v1/profiles on their own row and
-- set the flag true from the browser console. This trigger closes that: the
-- flag only moves when there is no JWT at all — i.e. from SQL or the
-- service-role key, which is where it is documented to be set.
--
-- The same trigger fences the payroll columns, which had no guard either: an
-- employee could raise their own hourly_rate, or clear time_tracked to stop
-- being on the clock. Only the owner may change them now (the auto-clock-in
-- cron writes nothing here, and reads are unaffected).
--
-- And it fences the login email of a protected / owner profile — see the
-- comment on that branch; without it the fence is decorative, because an admin
-- can take the owner's account instead of going around his gates.
--
-- INSERT needs no guard: is_owner() matches on p.id = auth.uid(), and a row
-- with that id already exists (PK), so an inserted row can never make its
-- inserter the owner.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_owner_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- No JWT: service-role client, a SQL console, or a DB-internal trigger.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
    RAISE EXCEPTION 'is_owner cannot be changed through the API'
      USING ERRCODE = '42501';
  END IF;

  -- Account-takeover fence. updateMemberEmailAction (team) lets ANY admin
  -- repoint another member's login address; migration 172 protects a protected
  -- profile's role / is_active / deleted_at but says nothing about email. So
  -- the second admin could point the owner's login at a mailbox they control,
  -- run a password reset, and simply BECOME the owner — which would defeat
  -- every gate above. The action writes profiles first, with the caller's own
  -- (RLS-bound) client, so blocking it here blocks the whole flow before the
  -- service-role auth update is ever reached.
  IF (OLD.is_protected OR OLD.is_owner) AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;

  IF (NEW.hourly_rate  IS DISTINCT FROM OLD.hourly_rate
   OR NEW.time_tracked IS DISTINCT FROM OLD.time_tracked
   OR NEW.auto_clock_in IS DISTINCT FROM OLD.auto_clock_in)
   AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'time-clock fields are owner-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_profiles_guard_owner_payroll ON public.profiles;
CREATE TRIGGER trg_profiles_guard_owner_payroll
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_owner_payroll();

INSERT INTO public.schema_version (version) VALUES (241) ON CONFLICT DO NOTHING;
