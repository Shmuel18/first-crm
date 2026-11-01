-- 257 — the expense alert waits for the description.
--
-- Kaufman (2026-11-01): the email said only the amount, never what the
-- expense was for. The row is filled inline field by field, and 255 fired the
-- moment the AMOUNT was set — the description arrived two seconds later, after
-- the alert had already gone out. Now the alert fires when the expense first
-- becomes complete: amount AND a non-blank description, in whichever order
-- they are typed. Later edits of a complete expense stay quiet.

CREATE OR REPLACE FUNCTION public.notify_expense_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := COALESCE(NEW.updated_by, NEW.created_by);
  v_actor_name TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL
     OR NEW.amount IS NULL
     OR NULLIF(btrim(NEW.description), '') IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.amount IS NOT NULL
     AND NULLIF(btrim(OLD.description), '') IS NOT NULL THEN
    RETURN NULL; -- already complete → already reported
  END IF;

  SELECT NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
    INTO v_actor_name
    FROM public.profiles
   WHERE id = v_actor;

  INSERT INTO public.notifications (user_id, actor_id, type, case_id, data)
  SELECT p.id,
         v_actor,
         'expense_added',
         NEW.case_id,
         jsonb_build_object(
           'amount', NEW.amount,
           'description', NEW.description,
           'actorName', v_actor_name,
           'caseLabel', public.notification_case_label(NEW.case_id)
         )
    FROM public.profiles p
   WHERE p.is_owner = TRUE
     AND COALESCE(p.is_active, TRUE)
     AND p.id IS DISTINCT FROM v_actor;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_expense_added() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_case_expenses_notify_added ON public.case_expenses;
CREATE TRIGGER trg_case_expenses_notify_added
  AFTER INSERT OR UPDATE OF amount, description ON public.case_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_expense_added();

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (257) ON CONFLICT DO NOTHING;
