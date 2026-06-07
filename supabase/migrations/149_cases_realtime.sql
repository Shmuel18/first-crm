-- =============================================================================
-- Migration 149: enable Supabase Realtime for newly-created cases
-- =============================================================================
-- The cases dashboard is server-rendered. Without a Realtime subscription, a
-- case created in another browser/session only appears after a manual refresh.
--
-- The client consumes INSERT events only and refreshes the dashboard. Realtime
-- evaluates the cases SELECT RLS policy for each subscriber, so users only
-- receive rows they are allowed to see. Default REPLICA IDENTITY is sufficient
-- because INSERT payloads include the new row.
-- =============================================================================

DO $realtime$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  END IF;
END $realtime$;

INSERT INTO public.schema_version (version) VALUES (149) ON CONFLICT DO NOTHING;
