-- =============================================================================
-- Migration 217: resolve case-comment author NAMES for non-admin viewers
-- =============================================================================
-- Bug: the comment thread joins author_id → profiles for the display name, but
-- profiles SELECT RLS is self-or-admin (it holds the calendar token — mig 145,
-- must NOT be broadened). So a non-admin (advisor/secretary) viewing a case
-- sees the comment BODY (case_comments RLS = can_view_case, mig 107) but every
-- OTHER person's name comes back NULL → shown as "—". Only the manager saw names.
-- Reported as "secretary can't see the comment"; the real gap was the missing
-- author attribution.
--
-- Fix mirrors list_case_mentionable_profiles (mig 194): a SECURITY DEFINER
-- function that exposes ONLY first/last name, and ONLY for authors of comments
-- on a case the caller may view. can_view_case(p_case_id) reads the caller's
-- auth.uid()/permissions (unchanged inside a DEFINER context), so a caller who
-- cannot view the case gets zero rows — no name leak. No tokens, no emails.
--
-- Idempotent. Deps: 107 (case_comments), 039/147/182 (can_view_case).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_case_comment_authors(p_case_id uuid)
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.first_name::text, p.last_name::text
    FROM public.case_comments cc
    JOIN public.profiles p ON p.id = cc.author_id
   WHERE cc.case_id = p_case_id
     AND public.can_view_case(p_case_id);
$$;

REVOKE ALL ON FUNCTION public.list_case_comment_authors(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_case_comment_authors(uuid) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (217) ON CONFLICT DO NOTHING;
