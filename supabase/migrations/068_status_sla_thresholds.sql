-- =============================================================================
-- Migration 068: Status SLA thresholds (per-status days)
-- =============================================================================
-- Purpose: Manager configures max-days-per-status in Settings. A daily cron
--   raises a bell notification (type = 'case_status_overdue') when a case sits
--   in a status longer than the configured threshold; re-fires once a week
--   while still overdue.
--
-- Storage: a single JSONB on office_settings keyed by case_statuses.key
--   (e.g. {"document_collection": 7, "awaiting_pre_approval": 14}). A missing
--   key means "no threshold" for that status (no alert).
--
-- Why JSONB on the singleton table (not a separate `status_sla` table):
--   data is tiny (≤11 entries), office-wide singleton, and the form is a
--   single transactional save. A normalized table would add joins for zero
--   structural benefit.
-- =============================================================================

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS sla_status_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Loose structural guard. The app validates value shape with Zod (positive
-- integer ≤365, status_key must be a known enum value); this CHECK only
-- prevents accidental scalar / array writes that would later break readers.
ALTER TABLE public.office_settings
  DROP CONSTRAINT IF EXISTS office_settings_sla_thresholds_is_object;

ALTER TABLE public.office_settings
  ADD CONSTRAINT office_settings_sla_thresholds_is_object
  CHECK (jsonb_typeof(sla_status_thresholds) = 'object');

-- =============================================================================
-- Extend notifications.type to allow case_status_overdue
-- =============================================================================
-- Migration 028 created the table with CHECK (type IN ('task_assigned',
-- 'task_completed')). The new SLA cron writes rows with type
-- 'case_status_overdue', so we drop+recreate the constraint to include it.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_assigned', 'task_completed', 'case_status_overdue'));

-- Helper index for the cron's dedupe query:
--   "is there a case_status_overdue notification for this (case_id, status_id,
--    entered_at) in the past 7 days?" — see /api/cron/status-sla-check.
-- We don't index data JSONB itself; case_id + created_at gets us cheap enough.
CREATE INDEX IF NOT EXISTS idx_notifications_case_overdue
  ON public.notifications(case_id, created_at DESC)
  WHERE type = 'case_status_overdue';
