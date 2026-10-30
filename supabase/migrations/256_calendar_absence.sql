-- 256 — office-wide absences on the calendar.
--
-- Kaufman (2026-10-30): a trip abroad or a vacation is entered once as a
-- date range ("from … until …") and shows on every day of it — and the whole
-- office sees it, so everyone knows who is out. A new event kind 'absence';
-- multi-day all-day events already fit the table (ends_at = the start of the
-- last day), so the only schema change is the kind list and visibility.
--
-- Writes are unchanged: save_calendar_event still lets a user without
-- manage_team_calendar put only themselves on an event, so an advisor can
-- enter their own absence and the secretary/manager can enter anyone's.

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_kind_check;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_kind_check
  CHECK (kind IN ('client_meeting', 'bank_meeting', 'signing', 'appraiser', 'reminder', 'absence', 'other'));

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
         OR e.kind = 'absence'
         OR public.has_permission('manage_team_calendar')
         OR EXISTS (SELECT 1 FROM public.calendar_event_participants p
                     WHERE p.event_id = e.id AND p.user_id = auth.uid())
         OR (e.case_id IS NOT NULL AND public.can_view_case(e.case_id))
       )
  );
$fn$;

REVOKE ALL ON FUNCTION public.can_view_calendar_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_calendar_event(UUID) TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (256) ON CONFLICT DO NOTHING;
