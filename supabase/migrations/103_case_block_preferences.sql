-- Per-user preference: which case-page blocks are open by default.
-- The case detail page is a stack of collapsible blocks (all closed by
-- default). This lets each user choose, in Settings → Display, which blocks
-- open on load. Stored as a JSONB map { block_key: boolean }; a missing key
-- means "closed", so existing users keep the all-closed behavior until they
-- opt in. Mirrors notification_preferences (migration 036): own-row table,
-- own-row RLS, missing row = defaults.
CREATE TABLE IF NOT EXISTS public.case_block_preferences (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_case_block_preferences_updated_at ON public.case_block_preferences;
CREATE TRIGGER trg_case_block_preferences_updated_at
  BEFORE UPDATE ON public.case_block_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_block_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_block_preferences_own ON public.case_block_preferences;
CREATE POLICY case_block_preferences_own ON public.case_block_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
