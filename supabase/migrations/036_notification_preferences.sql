-- Per-user email notification preferences. The in-app bell stays always-on;
-- these toggles only gate the (best-effort) email mirror. A missing row means
-- "all on" (the default), so existing users keep getting emails until they opt out.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_task_assigned BOOLEAN NOT NULL DEFAULT TRUE,
  email_task_completed BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_own ON public.notification_preferences;
CREATE POLICY notification_preferences_own ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
