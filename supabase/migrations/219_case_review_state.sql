-- =============================================================================
-- Migration 219: case_review_state — manager "unread / not-reviewed" tracking
-- =============================================================================
-- Kaufman forgets which cases he hasn't looked at. The dashboard grows a small
-- star on each case that is "unread" since the last reset (default: every
-- Sunday morning, Israel time), cleared the moment he opens the case. Manager-
-- only.
--
-- WHY A SEPARATE TABLE (not a column on cases):
--   `cases` carries three BEFORE UPDATE triggers — set_updated_at (006),
--   optimistic-lock version bump (056), and the trusted-columns guard (178) —
--   plus a generic AFTER-UPDATE audit trigger that logs every changed column.
--   Stamping a "viewed" timestamp on the case row would bump updated_at (which
--   drives the "last activity" tooltip + sort), churn the version, and spam the
--   audit log on every page open. A dedicated, trigger-free table sidesteps all
--   of that — and gives the follow-up "review queue / snooze" feature a home to
--   grow into (a review_due_at column lands here later, no new table).
--
-- The reset CADENCE is office config (manager-set) and lives on office_settings.
-- The reset BOUNDARY itself is COMPUTED at read time (domain/unread-star.ts),
-- so there is NO cron — each Sunday the boundary moves forward on its own.
--
-- Dependencies: 006 (cases), 010 (office_settings), 002 (is_admin), 143
-- (schema_version). Deliberately NO audit trigger and NO set_updated_at trigger.
-- =============================================================================

-- ---- Per-case manager review state ------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_review_state (
  case_id           UUID PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  -- Last time the manager opened this case. Compared against the computed reset
  -- boundary to decide "unread". Defaults to now() so the first stamp is a
  -- plain upsert.
  manager_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.case_review_state ENABLE ROW LEVEL SECURITY;

-- Manager-only, every operation. The star and its stamp are the manager's alone
-- (is_admin = the fixed manager role), so one ALL policy covers read + upsert.
DROP POLICY IF EXISTS "case_review_state_all" ON public.case_review_state;
CREATE POLICY "case_review_state_all" ON public.case_review_state
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- Office-wide cadence config ---------------------------------------------
-- 'off'    → no stars at all
-- 'daily'  → resets every Israel midnight
-- 'weekly' → resets on unread_star_weekday (0 = Sunday ... 6 = Saturday) midnight
ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS unread_star_cadence TEXT NOT NULL DEFAULT 'weekly'
    CHECK (unread_star_cadence IN ('off', 'daily', 'weekly'));

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS unread_star_weekday SMALLINT NOT NULL DEFAULT 0
    CHECK (unread_star_weekday BETWEEN 0 AND 6);

INSERT INTO public.schema_version (version) VALUES (219) ON CONFLICT DO NOTHING;
