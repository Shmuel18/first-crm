-- =============================================================================
-- Migration 163: client_email_log — record client-facing emails per case
-- =============================================================================
-- Until now every email path (advisor message, document request) called Resend
-- and forgot — nothing in the DB says "we emailed the client X on date Y".
-- The case activity feed needs that, and so does any future dispute ("you
-- never asked me for documents").
--
-- Scope: CASE-linked, CLIENT-facing emails only. Staff notification mirrors
-- and pre-case intake emails are not logged here (no case to hang them on).
-- Rows are immutable (no UPDATE/DELETE policies) — it's a log.
-- Dependencies: 039/147 (can_view_case), 001 (profiles), cases.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  -- What kind of send this was. Extend the CHECK when a new client-facing
  -- email path is added (deliberate, reviewable step).
  kind            TEXT NOT NULL CHECK (kind IN ('advisor_message', 'document_request')),
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  -- Final body text as the advisor sent it (post-edit, pre-branding shell).
  body            TEXT NOT NULL DEFAULT '',
  sent_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feed query is always "this case, newest first".
CREATE INDEX IF NOT EXISTS idx_client_email_log_case
  ON public.client_email_log(case_id, created_at DESC);

ALTER TABLE public.client_email_log ENABLE ROW LEVEL SECURITY;

-- SELECT — anyone who can view the case can see what was sent to its client.
DROP POLICY IF EXISTS "client_email_log_select" ON public.client_email_log;
CREATE POLICY "client_email_log_select" ON public.client_email_log
  FOR SELECT TO authenticated
  USING (public.can_view_case(case_id));

-- INSERT — the sender logs their own send on a case they can view. The send
-- actions additionally enforce userCanEditCase before any email goes out.
DROP POLICY IF EXISTS "client_email_log_insert" ON public.client_email_log;
CREATE POLICY "client_email_log_insert" ON public.client_email_log
  FOR INSERT TO authenticated
  WITH CHECK (
    sent_by = auth.uid()
    AND public.can_view_case(case_id)
  );

-- No UPDATE/DELETE policies on purpose — an email that went out, went out.

COMMENT ON TABLE public.client_email_log IS
  'Immutable log of client-facing emails per case (advisor messages, document '
  'requests). Powers the case activity feed. See migration 163.';

INSERT INTO public.schema_version (version) VALUES (163) ON CONFLICT DO NOTHING;
