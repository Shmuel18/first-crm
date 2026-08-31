-- =============================================================================
-- Migration 239: agreements — percentage fee, bilingual text, editable wording
-- =============================================================================
-- The office replaced the engagement agreement (new Hebrew + English drafts,
-- 2026-08-31). Three things change:
--
-- 1. THE FEE IS NOW A PERCENTAGE of the loan actually advanced, not a flat
--    sum ("שכר טרחה בשיעור של ___% מסכום ההלוואה"). The owner still wants the
--    client to see a shekel figure, so we ALSO print an estimate computed from
--    the case's requested mortgage amount. That estimate is explicitly not the
--    agreed number — the agreement's own clause says the fee follows the amount
--    actually advanced — so fee_total stops being authoritative and becomes a
--    nullable, informational snapshot. Its NOT NULL and the
--    advance <= total constraint both have to go: with no loan amount on file
--    the estimate is unknown, and an advance can legitimately exceed a low
--    estimate.
--
-- 2. THE AGREEMENT IS BILINGUAL and the sender picks the language per client.
--
-- 3. THE WORDING IS EDITABLE BY THE OFFICE (office_settings.agreement_text).
--    Because the wording can now change between sends, each row snapshots the
--    exact text the client was shown (text_snapshot) — the signed PDF is the
--    legal artifact, and this keeps the /sign page and any re-render faithful
--    to it rather than to whatever the template says today.
--
-- ACCESS CHANGE: sending is no longer bolted onto the collections pair. The
-- owner wants to delegate sending to the secretary without handing over the
-- collections module, so a dedicated key is introduced:
--   send_client_agreement — send / re-send / void an engagement agreement
-- Holding it necessarily exposes that case's agreed percentage and advance
-- (you cannot fill the document without them) — a deliberate, owner-approved
-- narrowing of the manager-only fee rule, scoped to the agreement surface.
--
-- Dependencies: 002 (has_permission), 169 (admin auto-grant trigger),
-- 238 (case_agreements).
-- =============================================================================

-- ---- Permission --------------------------------------------------------------
INSERT INTO public.permissions (key, name_he, name_en, category) VALUES
  ('send_client_agreement', 'לשלוח הסכם התקשרות לחתימה', 'Send Engagement Agreement', 'financial')
ON CONFLICT (key) DO UPDATE
  SET name_he = EXCLUDED.name_he,
      name_en = EXCLUDED.name_en,
      category = EXCLUDED.category;
-- Admin receives it automatically (trg_grant_new_permission_to_admin, mig 169).

-- ---- Columns -----------------------------------------------------------------
ALTER TABLE public.case_agreements
  -- The agreed rate, e.g. 1.500 (%). NULL only on legacy/manual rows.
  ADD COLUMN IF NOT EXISTS fee_percent NUMERIC(6, 3) CHECK (fee_percent >= 0 AND fee_percent <= 100),
  -- The loan figure the printed estimate was computed from, snapshotted so the
  -- document can be reproduced even after the case's number is revised.
  ADD COLUMN IF NOT EXISTS loan_amount NUMERIC(15, 2) CHECK (loan_amount >= 0),
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'he' CHECK (language IN ('he', 'en')),
  -- The exact wording shown to this client: { title, sections: [...] }.
  ADD COLUMN IF NOT EXISTS text_snapshot JSONB;

-- fee_total is now an informational ESTIMATE (loan x percent), not the agreed
-- sum — it may legitimately be unknown, and the advance may exceed it.
ALTER TABLE public.case_agreements ALTER COLUMN fee_total DROP NOT NULL;
ALTER TABLE public.case_agreements
  DROP CONSTRAINT IF EXISTS case_agreements_advance_within_total;

COMMENT ON COLUMN public.case_agreements.fee_percent IS
  'Agreed fee as a percentage of the loan actually advanced — the authoritative '
  'commercial term since the 2026-08-31 agreement revision.';
COMMENT ON COLUMN public.case_agreements.fee_total IS
  'INFORMATIONAL estimate (loan_amount x fee_percent) as printed for the client. '
  'Not the agreed sum: the agreement bills on the amount actually advanced.';
COMMENT ON COLUMN public.case_agreements.text_snapshot IS
  'The exact agreement wording shown to this client, captured at send time so a '
  'later edit of the office template cannot rewrite history.';

-- ---- Editable office-wide wording --------------------------------------------
ALTER TABLE public.office_settings
  -- { he: { title, sections:[{title, paragraphs:[]}] }, en: {...} }
  -- NULL / missing language = fall back to the wording shipped in the code.
  ADD COLUMN IF NOT EXISTS agreement_text JSONB;

COMMENT ON COLUMN public.office_settings.agreement_text IS
  'Office-edited engagement-agreement wording per language. NULL falls back to '
  'the default shipped in src/features/agreements/domain/agreement-text.ts.';

-- ---- RLS: recognise the new sending permission --------------------------------
-- SELECT — collections viewers keep access; agreement senders (e.g. the
-- secretary) need to see the section they operate.
DROP POLICY IF EXISTS "case_agreements_select" ON public.case_agreements;
CREATE POLICY "case_agreements_select" ON public.case_agreements
  FOR SELECT TO authenticated
  USING (
    (public.has_permission('view_collections') OR public.has_permission('send_client_agreement'))
    AND public.can_view_case(case_agreements.case_id)
  );

DROP POLICY IF EXISTS "case_agreements_insert" ON public.case_agreements;
CREATE POLICY "case_agreements_insert" ON public.case_agreements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('send_client_agreement')
    AND public.can_edit_case(case_agreements.case_id)
  );

-- UPDATE — cancel / void / re-send supersede.
DROP POLICY IF EXISTS "case_agreements_update" ON public.case_agreements;
CREATE POLICY "case_agreements_update" ON public.case_agreements
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('send_client_agreement')
    AND public.can_edit_case(case_agreements.case_id)
  )
  WITH CHECK (
    public.has_permission('send_client_agreement')
    AND public.can_edit_case(case_agreements.case_id)
  );

INSERT INTO public.schema_version (version) VALUES (239) ON CONFLICT DO NOTHING;
