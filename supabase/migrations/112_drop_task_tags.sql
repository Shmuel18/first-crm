-- =============================================================================
-- Migration 112: Drop tasks.tags (feature removed)
-- =============================================================================
-- The Kanban task-tag feature (migration 034) is removed per request. Dropping
-- the column cascades automatically to:
--   - the tasks_tags_check CHECK constraint (migration 034)
--   - the idx_tasks_tags GIN index           (migration 060)
-- No application code references tags after this change.
-- =============================================================================

ALTER TABLE public.tasks DROP COLUMN IF EXISTS tags;
