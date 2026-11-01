-- 258 — an expense without a description still reaches the owner.
--
-- 257 made the alert wait for the description, so the email says what the
-- expense was for. The gap: someone fills only the amount and walks away →
-- the owner never hears of it. Now:
--   * the alert fires the moment an expense is complete (amount + description);
--   * an expense that has an amount but stayed WITHOUT a description for 15
--     minutes is reported anyway by the 15-minute cron, marked as such;
--   * each expense alerts once — owner_alerted_at is claimed atomically, so
--     the trigger and the cron can never both send it.
--
-- owner_alerted_at is system-only: a guard trigger ignores client writes to
-- it, so an employee cannot pre-mark an expense to keep it from the owner.
-- Restored backups carry the column, so a restore does not re-alert.

ALTER TABLE public.case_expenses
  ADD COLUMN IF NOT EXISTS owner_alerted_at TIMESTAMPTZ;

-- Everything that already has an amount was reported under 255/257 (or
-- predates the alert) — don't let the cron dig it up. Without bumping
-- updated_at.
ALTER TABLE public.case_expenses DISABLE TRIGGER trg_case_expenses_updated_at;
UPDATE public.case_expenses
   SET owner_alerted_at = COALESCE(updated_at, created_at)
 WHERE amount IS NOT NULL AND owner_alerted_at IS NULL;
ALTER TABLE public.case_expenses ENABLE TRIGGER trg_case_expenses_updated_at;

-- -----------------------------------------------------------------------------
-- 1. Guard: clients can't set the flag
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.case_expenses_guard_alert_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.owner_alerted_at := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.owner_alerted_at END;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_case_expenses_guard_alert_flag ON public.case_expenses;
CREATE TRIGGER trg_case_expenses_guard_alert_flag
  BEFORE INSERT OR UPDATE ON public.case_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.case_expenses_guard_alert_flag();

-- -----------------------------------------------------------------------------
-- 2. One alert per expense (shared by the trigger and the cron)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alert_owners_of_expense(p_expense_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.case_expenses%ROWTYPE;
  v_actor UUID;
  v_actor_name TEXT;
BEGIN
  -- Claim first: whoever flips the flag sends; everyone else no-ops.
  UPDATE public.case_expenses
     SET owner_alerted_at = now()
   WHERE id = p_expense_id
     AND owner_alerted_at IS NULL
     AND deleted_at IS NULL
     AND amount IS NOT NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_actor := COALESCE(v_row.updated_by, v_row.created_by);
  SELECT NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
    INTO v_actor_name
    FROM public.profiles
   WHERE id = v_actor;

  INSERT INTO public.notifications (user_id, actor_id, type, case_id, data)
  SELECT p.id,
         v_actor,
         'expense_added',
         v_row.case_id,
         jsonb_build_object(
           'amount', v_row.amount,
           'description', NULLIF(btrim(v_row.description), ''),
           'actorName', v_actor_name,
           'caseLabel', public.notification_case_label(v_row.case_id)
         )
    FROM public.profiles p
   WHERE p.is_owner = TRUE
     AND COALESCE(p.is_active, TRUE)
     AND p.id IS DISTINCT FROM v_actor;

  RETURN TRUE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.alert_owners_of_expense(UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Trigger: alert as soon as the expense is complete
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_expense_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.owner_alerted_at IS NULL
     AND NEW.deleted_at IS NULL
     AND NEW.amount IS NOT NULL
     AND NULLIF(btrim(NEW.description), '') IS NOT NULL THEN
    PERFORM public.alert_owners_of_expense(NEW.id);
  END IF;
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_expense_added() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_case_expenses_notify_added ON public.case_expenses;
CREATE TRIGGER trg_case_expenses_notify_added
  AFTER INSERT OR UPDATE OF amount, description ON public.case_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_expense_added();

-- -----------------------------------------------------------------------------
-- 4. Cron sweep: amount entered, description never came
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alert_undescribed_expenses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id UUID;
  v_sent INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id
      FROM public.case_expenses
     WHERE owner_alerted_at IS NULL
       AND deleted_at IS NULL
       AND amount IS NOT NULL
       AND COALESCE(updated_at, created_at) < now() - interval '15 minutes'
  LOOP
    IF public.alert_owners_of_expense(v_id) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$fn$;

REVOKE ALL ON FUNCTION public.alert_undescribed_expenses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_undescribed_expenses() TO service_role;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (258) ON CONFLICT DO NOTHING;
