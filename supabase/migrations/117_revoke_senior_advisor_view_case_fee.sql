-- =============================================================================
-- Migration 117: Revoke view_case_fee from senior_advisor (manager-only default)
-- =============================================================================
-- GAP-Seed audit (release review): the original seed (004_lookups_seed.sql:138)
-- granted view_case_fee to senior_advisor, but CLAUDE.md / the spec mark the
-- agreed fee a MANAGER-ONLY field by default — so an "extended advisor" could
-- see every case's agreed fee out of the box. (view_expected_income was already
-- admin-only; only view_case_fee leaked.) This aligns the default to the spec.
--
-- The permission system stays configurable — this only changes the DEFAULT:
--   * a manager can re-grant it at the ROLE level in /settings/roles, or
--   * grant a per-user exception via user_permission_overrides
--     (has_permission checks override > role > false — see migration 002).
--
-- Explicit deny (is_granted = FALSE) rather than DELETE, so:
--   * the row is present for the role-editor toggle, and the intent is auditable;
--   * has_permission requires is_granted = TRUE (002:272), so FALSE denies.
-- Idempotent — safe to re-run.
-- =============================================================================

INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, FALSE
  FROM public.roles r
 CROSS JOIN public.permissions p
 WHERE r.key = 'senior_advisor'
   AND p.key = 'view_case_fee'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET is_granted = FALSE;
