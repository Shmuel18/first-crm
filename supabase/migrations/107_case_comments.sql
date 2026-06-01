-- =============================================================================
-- Migration 107: Case comments (internal team thread on the client card)
-- =============================================================================
-- Per spec: Kaufman-Finance-Spec/case-comments-spec.md (phase 1.1).
-- An async, team-only comment thread anchored to a case — replaces the internal
-- WhatsApp updates ("did the bank reply?", "client pushed to next week").
--
-- Design notes baked into this schema:
--   * Physical delete: no deleted_at and intentionally NO audit trigger — a
--     deleted comment leaves no trace by design (spec: a comment just vanishes,
--     no "deleted by X"). This also keeps potentially-sensitive client chatter
--     out of audit_log.
--   * edited_at: NULL = never edited; the action stamps it on UPDATE so the UI
--     can show "(edited)". No updated_at / set_updated_at trigger.
--   * Mentions are NOT a table (phase 1.2): @user-uuid is embedded in body and
--     notification rows are created on post. Nothing to add here for that.
-- Dependencies: 006 (cases), 002 (profiles, is_admin), 039 (can_view_case)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at   TIMESTAMPTZ
);

-- New, empty table → a plain CREATE INDEX is fine (no CONCURRENTLY needed; that
-- rule is for indexing already-populated tables).
CREATE INDEX IF NOT EXISTS idx_case_comments_case ON public.case_comments(case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_case_comments_author ON public.case_comments(author_id);

ALTER TABLE public.case_comments ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can view the parent case (mirrors the 039 child-table scope).
DROP POLICY IF EXISTS "case_comments_select" ON public.case_comments;
CREATE POLICY "case_comments_select" ON public.case_comments
  FOR SELECT TO authenticated
  USING (public.can_view_case(case_id));

-- Insert: must be able to view the case, and may only author as oneself.
DROP POLICY IF EXISTS "case_comments_insert" ON public.case_comments;
CREATE POLICY "case_comments_insert" ON public.case_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_view_case(case_id) AND author_id = auth.uid());

-- Update: only the author edits their own comment, and can't move it onto a
-- case they can't see (defense-in-depth beyond the action, which only ever
-- patches body + edited_at).
DROP POLICY IF EXISTS "case_comments_update" ON public.case_comments;
CREATE POLICY "case_comments_update" ON public.case_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid() AND public.can_view_case(case_id));

-- Delete: the author, or a manager (is_admin) moderating the thread.
DROP POLICY IF EXISTS "case_comments_delete" ON public.case_comments;
CREATE POLICY "case_comments_delete" ON public.case_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin());
