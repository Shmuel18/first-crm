-- =============================================================================
-- Migration 113: Genericize advisor role display names
-- =============================================================================
-- Both advisor roles now DISPLAY as "יועץ משכנתאות" everywhere in the app
-- (topbar, profile, etc.) — the junior/senior wording (יועץ זוטר / יועץ בכיר from
-- migration 002) is removed. The 2 levels stay distinct for PERMISSIONS; the
-- admin-only management screens (/settings/people) distinguish them via i18n
-- labels keyed by the role KEY:
--   senior_advisor → "יועץ משכנתאות מורחב"  (more permissions)
--   junior_advisor → "יועץ משכנתאות"        (base)
--
-- Role KEYS are intentionally unchanged — they drive RLS / permissions / the
-- default-role assignment. This migration only touches the display names.
-- =============================================================================

UPDATE public.roles
   SET name_he = 'יועץ משכנתאות',
       name_en = 'Mortgage Advisor'
 WHERE key IN ('senior_advisor', 'junior_advisor');
