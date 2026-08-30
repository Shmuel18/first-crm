-- =============================================================================
-- Migration 238: client engagement agreements (הסכם התקשרות) + digital signature
-- =============================================================================
-- The office is moving from a printed/emailed engagement agreement to one the
-- client signs from the phone. The flow:
--
--   1. Manager fills the fee in the מנהלה block (total + advance; the balance
--      due at execution is DERIVED, never stored twice) and hits "send".
--   2. We snapshot the fee + the client's identity onto a row here, mint a
--      single-use link token, and email the client a /sign/<token> URL.
--   3. The client reads the agreement, draws a signature, submits. We stamp
--      the signature into a PDF, store it, mirror it to the case's Drive
--      folder and flip the row to 'signed'.
--
-- WHY A SIDE TABLE (not columns on cases / case_financials): the signature is
-- an evidentiary record — who signed, when, from which IP/user-agent, and on
-- WHICH TEXT (agreement_version) with WHICH numbers. Those numbers must not
-- follow later edits to case_financials.fee_amount, or the signed PDF and the
-- CRM would disagree about what was agreed. Same reasoning as migration 219.
--
-- TOKEN HANDLING: only the SHA-256 of the token is stored. A database read
-- (backup, snapshot, leaked dump) therefore cannot be replayed into a signing
-- session. The plaintext token exists only in the email we send.
--
-- ACCESS: no new permission keys. Reuses the collections pair —
--   view_collections   → see the agreement section + its status
--   manage_collections → send / cancel an agreement (the send dialog ALSO
--                        requires view_case_fee, since it shows the amounts)
-- The signing side is unauthenticated by design and runs through the service
-- role (same shape as the public intake since migration 166) — anon gets no
-- grants on this table at all.
--
-- Dependencies: 002 (has_permission, set_updated_at), 025 (case_financials),
-- 106/147 (can_edit_case), 039 (can_view_case), 206 (collections permissions),
-- 237 (latest restore_backup_snapshot body — recreated here with
-- case_agreements added).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_agreements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  -- sent → awaiting the client; signed → terminal, evidentiary;
  -- cancelled → superseded by a re-send, or withdrawn by the office.
  status             TEXT NOT NULL DEFAULT 'sent'
                       CHECK (status IN ('sent', 'signed', 'cancelled')),
  -- 'digital' = signed on the /sign page; 'manual' = the office marked it as
  -- signed outside the system (paper, in person). Kaufman explicitly wants the
  -- plain "did they sign?" checkbox alongside the digital flow.
  signed_method      TEXT CHECK (signed_method IN ('digital', 'manual')),

  -- SHA-256 (hex) of the single-use link token. Never the token itself.
  -- NULL for manually-marked rows (nothing was ever sent).
  token_hash         TEXT UNIQUE,
  -- Which revision of the agreement text the client actually saw. Bump the TS
  -- constant whenever the wording changes so old rows stay interpretable.
  agreement_version  TEXT NOT NULL,

  -- The commercial terms AS PRINTED in the document the client signed.
  fee_total          NUMERIC(15, 2) NOT NULL CHECK (fee_total >= 0),
  fee_advance        NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (fee_advance >= 0),
  CONSTRAINT case_agreements_advance_within_total CHECK (fee_advance <= fee_total),

  -- The client's identity as printed. Snapshotted for the same reason as the
  -- fee: the borrower row may be corrected later; the document may not.
  client_name        TEXT NOT NULL,
  client_national_id TEXT,
  client_phone       TEXT,
  -- NULL only on manually-marked rows (nothing was emailed).
  client_email       TEXT,

  sent_by            UUID REFERENCES public.profiles(id),
  sent_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL on manually-marked rows; a live link always has a deadline.
  expires_at         TIMESTAMPTZ,

  -- A row awaiting signature must actually be reachable: link + address + TTL.
  CONSTRAINT case_agreements_sent_is_complete CHECK (
    status <> 'sent'
    OR (token_hash IS NOT NULL AND client_email IS NOT NULL AND expires_at IS NOT NULL)
  ),
  CONSTRAINT case_agreements_signed_has_method CHECK (
    status <> 'signed' OR signed_method IS NOT NULL
  ),

  -- Signature evidence.
  signed_at          TIMESTAMPTZ,
  signer_ip          TEXT,
  signer_user_agent  TEXT,
  -- base64 PNG of the drawn signature (a few KB). Kept so the PDF can be
  -- re-rendered from the record without re-asking the client.
  signature_png      TEXT,

  -- Where the signed PDF lives. Supabase Storage is canonical; Drive is the
  -- convenience mirror the office actually browses.
  pdf_path           TEXT,
  drive_file_id      TEXT,
  drive_file_url     TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Empty table at creation → plain indexes (CONCURRENTLY can't run in the
-- transaction the migration runner wraps this in, and isn't needed here).
CREATE INDEX IF NOT EXISTS idx_case_agreements_case
  ON public.case_agreements(case_id, sent_at DESC);

-- At most ONE outstanding agreement per case: a re-send must cancel the
-- previous one first, so a client can never hold two live signing links.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_agreements_open
  ON public.case_agreements(case_id)
  WHERE status = 'sent';

CREATE TRIGGER trg_case_agreements_updated_at
  BEFORE UPDATE ON public.case_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.case_agreements ENABLE ROW LEVEL SECURITY;

-- SELECT — anyone who may see the case AND holds view_collections. The row
-- carries the agreed fee, so it stays inside the financial permission fabric
-- rather than being readable by every advisor on the case.
DROP POLICY IF EXISTS "case_agreements_select" ON public.case_agreements;
CREATE POLICY "case_agreements_select" ON public.case_agreements
  FOR SELECT TO authenticated
  USING (
    public.has_permission('view_collections')
    AND public.can_view_case(case_agreements.case_id)
  );

-- INSERT — sending is a write on the case: manage_collections AND edit rights.
DROP POLICY IF EXISTS "case_agreements_insert" ON public.case_agreements;
CREATE POLICY "case_agreements_insert" ON public.case_agreements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('manage_collections')
    AND public.can_edit_case(case_agreements.case_id)
  );

-- UPDATE — office-side this is only ever "cancel". The signing write comes
-- from the unauthenticated flow through the service role, which bypasses RLS.
DROP POLICY IF EXISTS "case_agreements_update" ON public.case_agreements;
CREATE POLICY "case_agreements_update" ON public.case_agreements
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('manage_collections')
    AND public.can_edit_case(case_agreements.case_id)
  )
  WITH CHECK (
    public.has_permission('manage_collections')
    AND public.can_edit_case(case_agreements.case_id)
  );

-- No DELETE policy: a signed agreement is evidence. Superseding is 'cancelled'.

COMMENT ON TABLE public.case_agreements IS
  'Client engagement agreements (הסכם התקשרות) sent for digital signature. '
  'Snapshots the fee + client identity at send time; stores only the SHA-256 '
  'of the signing token. See migration 238.';

COMMENT ON COLUMN public.case_agreements.token_hash IS
  'SHA-256 hex of the single-use signing token. The token itself is never '
  'persisted — a DB read cannot be replayed into a signing session.';

-- -----------------------------------------------------------------------------
-- client_email_log: the sign-request email is a new client-facing send kind.
-- Migration 163 asked exactly for this: "Extend the CHECK when a new
-- client-facing send kind appears." The TS ClientEmailKind union + the
-- caseActivity.events string are updated in the same change.
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_email_log
  DROP CONSTRAINT IF EXISTS client_email_log_kind_check;
ALTER TABLE public.client_email_log
  ADD CONSTRAINT client_email_log_kind_check
  CHECK (kind IN ('advisor_message', 'document_request', 'agreement_sign_request'));

-- -----------------------------------------------------------------------------
-- Disaster-recovery: include case_agreements in backup/restore. Recreates the
-- migration-237 restore_backup_snapshot body verbatim with case_agreements
-- added after case_fee_payments (FK targets: cases, profiles — both restored
-- earlier). No deleted_at column, so it does NOT join the strip list. The TS
-- backup writer (BACKUP_TABLES) gets the matching entry in the same change.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'roles', 'permissions', 'banks', 'case_bank_statuses', 'case_statuses', 'case_types',
    'document_categories', 'income_types', 'holidays', 'profiles', 'office_settings',
    'role_permissions', 'user_permission_overrides', 'ai_digest_subscriptions', 'ai_scheduled_questions', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'document_classifications', 'case_expenses', 'case_fee_payments',
    'case_agreements',
    'case_associated_advisors', 'case_comments', 'case_properties', 'case_payouts',
    'maaser_payments', 'maaser_ledger_entries',
    'time_entries', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'case_fee_payments', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'maaser_ledger_entries', 'time_entries', 'message_templates'
  ];
  v_tbl text;
  v_rows jsonb;
  v_inserted bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF COALESCE((p_snapshot->>'version')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'unsupported backup version' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.restoring_backup', 'true', true);

  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_rows := p_snapshot->'data'->v_tbl;
    IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      v_result := v_result || jsonb_build_object(v_tbl, 0);
      CONTINUE;
    END IF;

    IF v_tbl = ANY(v_tables_with_deleted_at) THEN
      SELECT jsonb_agg(elem - 'deleted_at') INTO v_rows
        FROM jsonb_array_elements(v_rows) AS elem;
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
      v_tbl, v_tbl
    ) USING v_rows;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_result := v_result || jsonb_build_object(v_tbl, v_inserted);
  END LOOP;

  PERFORM set_config('app.restoring_backup', 'false', true);
  RETURN v_result;
END;
$$;

INSERT INTO public.schema_version (version) VALUES (238) ON CONFLICT DO NOTHING;
