-- =============================================================================
-- Migration 082: Case-status palette refresh + remove awaiting_pre_approval
-- =============================================================================
-- Purpose:
--   1. Drop the 'awaiting_pre_approval' status (kept being skipped in practice).
--      Existing cases on that status are re-mapped to 'submitted_to_bank' so the
--      cases.status_id FK stays valid.
--   2. Recolor every remaining status with a more mature, modern palette
--      (Tailwind 600-800 saturation range — less neon, fits the gold + black
--      brand better in pill backgrounds).
-- Dependencies: 004_lookups_seed.sql (initial seed)
-- =============================================================================

-- 1a. Re-map cases currently sitting on awaiting_pre_approval.
--     'submitted_to_bank' is the closest immediately-prior step in the flow,
--     so a case that was "awaiting pre-approval" semantically goes back to
--     "submitted to bank".
UPDATE public.cases
SET status_id = (SELECT id FROM public.case_statuses WHERE key = 'submitted_to_bank')
WHERE status_id = (SELECT id FROM public.case_statuses WHERE key = 'awaiting_pre_approval');

-- 1b. Re-map stage_durations (per-case time-in-status history) the same way.
--     Without this the DELETE in step 2 trips the FK constraint
--     stage_durations_status_id_fkey. Merging the history into
--     'submitted_to_bank' under-counts that bucket slightly but keeps the
--     timeline contiguous — preferable to dropping the rows outright.
UPDATE public.stage_durations
SET status_id = (SELECT id FROM public.case_statuses WHERE key = 'submitted_to_bank')
WHERE status_id = (SELECT id FROM public.case_statuses WHERE key = 'awaiting_pre_approval');

-- 1c. Clear required_at_stage_id references on case_type_documents (config
--     "this doc must be present by stage X"). NULL means "no specific stage
--     required" — fine for a status that no longer exists. If any config
--     genuinely needed it pinned, an admin can re-bind via the settings UI.
UPDATE public.case_type_documents
SET required_at_stage_id = NULL
WHERE required_at_stage_id = (SELECT id FROM public.case_statuses WHERE key = 'awaiting_pre_approval');

-- 2. Drop the status row. is_system=TRUE blocks UI deletion, but a direct
--    DELETE bypasses that check (intentional — schema-level cleanup).
DELETE FROM public.case_statuses WHERE key = 'awaiting_pre_approval';

-- 3. Recolor remaining 10 statuses.
--    Palette rationale: each color is taken from a Tailwind 600-800 step so
--    the pill backgrounds (rendered with 25% alpha overlay) stay readable
--    against white and the foreground text keeps WCAG-AA contrast.
UPDATE public.case_statuses SET color = '#64748B' WHERE key = 'case_opened';            -- slate-500
UPDATE public.case_statuses SET color = '#C2410C' WHERE key = 'document_collection';    -- orange-700
UPDATE public.case_statuses SET color = '#0F766E' WHERE key = 'ready_for_submission';   -- teal-700
UPDATE public.case_statuses SET color = '#1D4ED8' WHERE key = 'submitted_to_bank';      -- blue-700
UPDATE public.case_statuses SET color = '#15803D' WHERE key = 'pre_approved';           -- green-700
UPDATE public.case_statuses SET color = '#92400E' WHERE key = 'collateral';             -- amber-800
UPDATE public.case_statuses SET color = '#6D28D9' WHERE key = 'execution';              -- purple-700
UPDATE public.case_statuses SET color = '#1F2937' WHERE key = 'closed';                 -- gray-800
UPDATE public.case_statuses SET color = '#B91C1C' WHERE key = 'stuck';                  -- red-700
UPDATE public.case_statuses SET color = '#78716C' WHERE key = 'on_hold';                -- stone-500
