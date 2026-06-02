-- =============================================================================
-- Migration 127: enable Supabase Realtime on notifications (instant bell)
-- =============================================================================
-- The notification bell previously refreshed only when the layout re-rendered
-- (navigation / page refresh) — a recipient didn't see a new task notification
-- until they moved around the app. The bell now subscribes to Realtime
-- postgres_changes (INSERT) so it appears the instant the row is created, and a
-- critical-task notification blinks the bell immediately.
--
-- Realtime applies the table's RLS to each subscriber (using their JWT), and the
-- notifications SELECT policy is `user_id = auth.uid()` (mig 028) — so every
-- client only receives its OWN notification rows. The client also pins an
-- explicit `user_id=eq.<self>` filter for efficiency.
--
-- Only INSERT is consumed, so the default REPLICA IDENTITY is sufficient (the
-- full new row is delivered on INSERT). Idempotent: re-running is a no-op.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
