-- Soft-delete marker for team members.
--
-- Distinct from is_active (deactivation), which keeps the member VISIBLE in the
-- team list (greyed). deleted_at hides them from the list entirely while KEEPING
-- the profiles row, so every historical reference stays attributed to them:
--   * audit_log.user_id (FK has no name snapshot — a hard delete would blank it)
--   * closed / archived cases (cases.assigned_advisor_id)
--   * authored notes, etc.
--
-- The "delete member" action reassigns the member's still-open work to the
-- acting manager, then stamps deleted_at + is_active=false. Login is blocked by
-- the existing is_active gate; the list filter (deleted_at IS NULL) removes them
-- from the team view. No RLS change needed: setting deleted_at goes through the
-- same manage_users UPDATE policy that already governs is_active.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
