-- =============================================================================
-- Migration 231: email_inbox — the smart-mail triage queue (Epic 2, ai-v2-spec §3)
-- =============================================================================
-- One row per email the intake cron saw in the office's MAIN inbox (product
-- decision 2026-08-23: the engine reads EVERY incoming email; unclear context
-- escalates to a human). What is stored is deliberately minimal:
--
--   ** NO EMAIL BODIES ARE EVER STORED ** — only headers, the AI's one-line
--   Hebrew summary, and the routing verdict. The body stays in Gmail; the
--   deep-link reopens it there. This is the privacy stance of spec §3.4.
--
-- Category values (the 7 routes of spec §3.3):
--   client_documents / client_message / probable_client / bank /
--   vendor_or_marketing / internal / unclear
-- Status lifecycle:
--   auto_processed — routine (docs filed, or marketing/internal logged)
--   new            — client message awaiting the advisor's eyes
--   needs_review   — the "הקפצה": unclear/unmatched/ambiguous → human queue
--   acknowledged / dismissed — human closed it
-- triage_mode records which rollout mode produced the row (shadow rows are
-- "what I would have done" — the calibration surface of spec §3.6).
--
-- RLS: view_ai_inbox holders (manager/secretary by assignment) see all rows;
-- an advisor additionally sees rows linked to cases they can see (the EXISTS
-- subquery runs under the caller's own cases policies). INSERTs come only
-- from the service-role cron (no INSERT policy).
--
-- Backup: EXCLUDED (documented in backup-restore-allowlist.test.ts) — the
-- queue is re-derivable from Gmail + retriage; it is operational state, not
-- durable business record.
--
-- Permission key: view_ai_inbox (snake_case per DB convention — the spec's
-- "ai.inbox" name maps to this key). Admin gets it automatically via
-- trg_grant_new_permission_to_admin (mig 169).
--
-- Dependencies: cases, profiles, has_permission_for (mig 188), 143.
-- Indexes inline: table is born empty.
-- =============================================================================

INSERT INTO public.permissions (key, name_he, name_en, category) VALUES
  ('view_ai_inbox', 'לראות דואר נכנס חכם', 'View Smart Inbox', 'system')
ON CONFLICT (key) DO UPDATE
  SET name_he = EXCLUDED.name_he,
      name_en = EXCLUDED.name_en,
      category = EXCLUDED.category;

CREATE TABLE IF NOT EXISTS public.email_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NULL,
  subject TEXT NULL,
  received_at TIMESTAMPTZ NULL,
  category TEXT NOT NULL CHECK (category IN (
    'client_documents', 'client_message', 'probable_client', 'bank',
    'vendor_or_marketing', 'internal', 'unclear'
  )),
  confidence NUMERIC(4,3) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  summary_he TEXT NULL,
  case_id UUID NULL REFERENCES public.cases(id) ON DELETE SET NULL,
  attachments_count INTEGER NOT NULL DEFAULT 0,
  -- documents rows created from this email's attachments (uuid strings).
  ingested_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  triage_mode TEXT NOT NULL CHECK (triage_mode IN ('shadow', 'suggest', 'auto')),
  status TEXT NOT NULL CHECK (status IN (
    'auto_processed', 'new', 'needs_review', 'acknowledged', 'dismissed'
  )),
  resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_inbox IS
  'AI mail-triage queue over the office Gmail inbox. Headers + one-line summary + routing verdict ONLY — bodies are never stored (ai-v2-spec.md §3). Written by the service-role intake cron.';

CREATE INDEX IF NOT EXISTS idx_email_inbox_status_received
  ON public.email_inbox (status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_case
  ON public.email_inbox (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_inbox_resolved_by
  ON public.email_inbox (resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_inbox_thread
  ON public.email_inbox (gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_inbox_select ON public.email_inbox;
CREATE POLICY email_inbox_select ON public.email_inbox
  FOR SELECT USING (
    public.has_permission_for(auth.uid(), 'view_ai_inbox')
    OR (
      case_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = email_inbox.case_id)
    )
  );

DROP POLICY IF EXISTS email_inbox_update ON public.email_inbox;
CREATE POLICY email_inbox_update ON public.email_inbox
  FOR UPDATE USING (
    public.has_permission_for(auth.uid(), 'view_ai_inbox')
    OR (
      case_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = email_inbox.case_id)
    )
  ) WITH CHECK (
    public.has_permission_for(auth.uid(), 'view_ai_inbox')
    OR (
      case_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = email_inbox.case_id)
    )
  );

-- No INSERT/DELETE policies: rows come from the service-role intake pipeline.

INSERT INTO public.schema_version (version) VALUES (231) ON CONFLICT DO NOTHING;
