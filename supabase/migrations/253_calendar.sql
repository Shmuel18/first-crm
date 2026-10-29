-- 253 — the office calendar (לוח שנה).
--
-- One in-app calendar (no Google sync, by the office's choice 2026-10-29). Most
-- of what it shows is DERIVED from existing data — target dates, task due
-- dates, stage changes, document / ID expiry, agreement dates, case openings —
-- and read by the app under the caller's own RLS. This migration adds only
-- what has no home yet: free events (meetings, signings, reminders…).
--
--   calendar_events               — the event, optionally linked to a case
--   calendar_event_participants   — staff on the event (each gets the reminder)
--   manage_team_calendar          — new permission: create/edit events for OTHER
--                                   staff (manager + secretary by default; a
--                                   regular advisor schedules only themself)
--   'calendar_reminder'           — new bell kind, fired by the reminders cron
--
-- Writes go through two SECURITY DEFINER RPCs so the event and its
-- participants change atomically and every permission rule lives in one place.

-- -----------------------------------------------------------------------------
-- 1. Permission
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (key, name_he, name_en, category, description_he, description_en, is_system)
VALUES (
  'manage_team_calendar',
  'לנהל את לוח השנה של הצוות',
  'Manage the team calendar',
  'cases',
  'יצירה ועריכה של אירועים עבור אנשי צוות אחרים',
  'Create and edit calendar events for other staff members',
  FALSE
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, TRUE
  FROM public.roles r
  JOIN public.permissions p ON p.key = 'manage_team_calendar'
 WHERE r.key IN ('admin', 'secretary')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  kind             TEXT NOT NULL DEFAULT 'other'
                     CONSTRAINT calendar_events_kind_check
                     CHECK (kind IN ('client_meeting', 'bank_meeting', 'signing', 'appraiser', 'reminder', 'other')),
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ,
  all_day          BOOLEAN NOT NULL DEFAULT FALSE,
  location         TEXT CHECK (location IS NULL OR length(location) <= 200),
  notes            TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  case_id          UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  -- Minutes before starts_at to ring the bell; NULL = no reminder.
  reminder_minutes INT CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 10080),
  reminded_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.profiles(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID REFERENCES public.profiles(id),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT calendar_events_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_starts
  ON public.calendar_events(starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_case
  ON public.calendar_events(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_reminder_due
  ON public.calendar_events(starts_at)
  WHERE deleted_at IS NULL AND reminder_minutes IS NOT NULL AND reminded_at IS NULL;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.calendar_event_participants (
  event_id   UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_participants_user
  ON public.calendar_event_participants(user_id);

-- -----------------------------------------------------------------------------
-- 3. Visibility: the creator, the participants, anyone who can see the linked
--    case, and holders of manage_team_calendar.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_calendar_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.calendar_events e
     WHERE e.id = p_event_id
       AND e.deleted_at IS NULL
       AND (
         e.created_by = auth.uid()
         OR public.has_permission('manage_team_calendar')
         OR EXISTS (SELECT 1 FROM public.calendar_event_participants p
                     WHERE p.event_id = e.id AND p.user_id = auth.uid())
         OR (e.case_id IS NOT NULL AND public.can_view_case(e.case_id))
       )
  );
$fn$;

REVOKE ALL ON FUNCTION public.can_view_calendar_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_calendar_event(UUID) TO authenticated;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_events_select" ON public.calendar_events;
CREATE POLICY "calendar_events_select" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (public.can_view_calendar_event(id));

DROP POLICY IF EXISTS "calendar_event_participants_select" ON public.calendar_event_participants;
CREATE POLICY "calendar_event_participants_select" ON public.calendar_event_participants
  FOR SELECT TO authenticated
  USING (public.can_view_calendar_event(event_id));

-- No INSERT/UPDATE/DELETE policies: writes go through the RPCs below.
GRANT SELECT ON public.calendar_events, public.calendar_event_participants TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. save_calendar_event — create (p_id NULL) or edit. Returns the event id.
--    Rules: an event with anyone but yourself on it needs manage_team_calendar;
--    editing needs to be its creator, a participant, or manage_team_calendar;
--    linking a case needs to be able to see it. Moving the start (or changing
--    the reminder) clears reminded_at so the reminder rings for the new time.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_calendar_event(
  p_id UUID,
  p_title TEXT,
  p_kind TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_all_day BOOLEAN,
  p_location TEXT,
  p_notes TEXT,
  p_case_id UUID,
  p_reminder_minutes INT,
  p_participant_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_team BOOLEAN := public.has_permission('manage_team_calendar');
  v_participants UUID[] := COALESCE(p_participant_ids, ARRAY[]::UUID[]);
  v_id UUID;
  v_old RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'save_calendar_event: no auth context' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_participants) = 0 THEN
    v_participants := ARRAY[v_actor];
  END IF;
  IF NOT v_team AND v_participants <> ARRAY[v_actor] THEN
    RAISE EXCEPTION 'save_calendar_event: only yourself without manage_team_calendar'
      USING ERRCODE = '42501';
  END IF;
  IF p_case_id IS NOT NULL AND NOT public.can_view_case(p_case_id) THEN
    RAISE EXCEPTION 'save_calendar_event: case not visible' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.calendar_events (
      title, kind, starts_at, ends_at, all_day, location, notes, case_id,
      reminder_minutes, created_by, updated_by
    ) VALUES (
      btrim(p_title), p_kind, p_starts_at, p_ends_at, COALESCE(p_all_day, FALSE),
      NULLIF(btrim(p_location), ''), NULLIF(btrim(p_notes), ''), p_case_id,
      p_reminder_minutes, v_actor, v_actor
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_old FROM public.calendar_events WHERE id = p_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'save_calendar_event: event % not found', p_id USING ERRCODE = 'P0002';
    END IF;
    IF NOT (
      v_team
      OR v_old.created_by = v_actor
      OR EXISTS (SELECT 1 FROM public.calendar_event_participants
                  WHERE event_id = p_id AND user_id = v_actor)
    ) THEN
      RAISE EXCEPTION 'save_calendar_event: not allowed to edit' USING ERRCODE = '42501';
    END IF;
    UPDATE public.calendar_events
       SET title = btrim(p_title),
           kind = p_kind,
           starts_at = p_starts_at,
           ends_at = p_ends_at,
           all_day = COALESCE(p_all_day, FALSE),
           location = NULLIF(btrim(p_location), ''),
           notes = NULLIF(btrim(p_notes), ''),
           case_id = p_case_id,
           reminder_minutes = p_reminder_minutes,
           reminded_at = CASE
             WHEN p_starts_at IS DISTINCT FROM v_old.starts_at
               OR p_reminder_minutes IS DISTINCT FROM v_old.reminder_minutes
             THEN NULL ELSE reminded_at END,
           updated_by = v_actor
     WHERE id = p_id;
    v_id := p_id;
    DELETE FROM public.calendar_event_participants WHERE event_id = v_id;
  END IF;

  INSERT INTO public.calendar_event_participants (event_id, user_id)
  SELECT v_id, u FROM unnest(v_participants) AS u
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_calendar_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, UUID, INT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_calendar_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, UUID, INT, UUID[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. delete_calendar_event — soft delete, same edit rule.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_calendar_event(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'delete_calendar_event: no auth context' USING ERRCODE = '42501';
  END IF;
  UPDATE public.calendar_events e
     SET deleted_at = now(), updated_by = v_actor
   WHERE e.id = p_id
     AND e.deleted_at IS NULL
     AND (
       public.has_permission('manage_team_calendar')
       OR e.created_by = v_actor
       OR EXISTS (SELECT 1 FROM public.calendar_event_participants
                   WHERE event_id = e.id AND user_id = v_actor)
     );
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_calendar_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. New bell kind for the reminders cron (re-states the full set from 236).
-- -----------------------------------------------------------------------------
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
    'ai_digest',
    'calendar_reminder'
  ));

-- -----------------------------------------------------------------------------
-- 7. Restore allowlist — restated from migration 252 with the two calendar
--    tables appended (calendar_events is soft-deleted → deleted_at strip too).
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
    'time_entries', 'employee_pay_rates', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks',
    'professional_contacts', 'calendar_events', 'calendar_event_participants'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'case_fee_payments', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'maaser_ledger_entries', 'time_entries', 'message_templates',
    'professional_contacts', 'calendar_events'
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

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (253) ON CONFLICT DO NOTHING;
