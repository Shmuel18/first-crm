-- =============================================================================
-- Migration 232: document_classifications (Epic 1 of ai-v2-spec.md)
-- =============================================================================
-- One row per AI classification run over a document: what the model thinks the
-- document is, which borrower it belongs to, its period, validity flags, and
-- what the system DID with that answer (the decision). Provenance + calibration
-- data: every human accept/reject lands here too, which is what the golden-set
-- accuracy reviews read (spec §2.7).
--
-- Decision values (spec §2.3, thresholds live in TS domain code):
--   'shadow'       — mode=shadow: logged only, nothing touched
--   'auto'         — category applied automatically (high confidence, no human
--                    category present)
--   'suggested'    — amber suggestion awaiting advisor accept/reject
--   'needs_review' — confidence too low / unknown type: doc stays uncategorized
--   'validated'    — doc already had a HUMAN category; row carries flags only
--                    (stale / name mismatch / category disagreement). AI never
--                    overrides a human choice (spec §0.2).
--
-- RLS: visibility inherits from the parent document via an EXISTS subquery —
-- whoever can see the document sees its classification rows (the documents
-- policies already encode case access). INSERTs happen exclusively through the
-- service-role pipeline (no INSERT policy); UPDATE is limited to the resolution
-- columns' flow (accept/reject) app-side, gated here by the same visibility.
--
-- Backup: durable business data (human resolutions are not re-derivable) →
-- BACKUP_TABLES + restore_backup_snapshot below (allowlist test enforces).
-- Indexes inline: table is born empty (CONCURRENTLY rule is for populated).
--
-- Dependencies: documents, cases, document_categories, borrowers, profiles,
-- 143 (schema_version), 220 (previous restore_backup_snapshot body).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  -- Denormalized for cheap case-scoped queries (the exceptions queue).
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  suggested_category_id UUID NULL REFERENCES public.document_categories(id) ON DELETE SET NULL,
  -- The raw key survives category deletion — eval data stays meaningful.
  suggested_category_key TEXT NULL,
  matched_borrower_id UUID NULL REFERENCES public.borrowers(id) ON DELETE SET NULL,
  borrower_name_on_doc TEXT NULL,
  period TEXT NULL CHECK (period IS NULL OR period ~ '^\d{4}-\d{2}$'),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  model TEXT NOT NULL,
  reason TEXT NULL,
  decision TEXT NOT NULL
    CHECK (decision IN ('shadow', 'auto', 'suggested', 'needs_review', 'validated')),
  resolution TEXT NULL CHECK (resolution IN ('accepted', 'rejected')),
  resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_classifications IS
  'AI document-classification runs: proposed type/borrower/period, validity flags, decision taken, human resolution. Provenance + calibration; AI never overrides a human category (ai-v2-spec.md §2).';

CREATE INDEX IF NOT EXISTS idx_doc_classifications_document
  ON public.document_classifications (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_classifications_case_decision
  ON public.document_classifications (case_id, decision);
CREATE INDEX IF NOT EXISTS idx_doc_classifications_borrower
  ON public.document_classifications (matched_borrower_id) WHERE matched_borrower_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_classifications_category
  ON public.document_classifications (suggested_category_id) WHERE suggested_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_classifications_resolved_by
  ON public.document_classifications (resolved_by) WHERE resolved_by IS NOT NULL;

ALTER TABLE public.document_classifications ENABLE ROW LEVEL SECURITY;

-- Visibility rides the parent document's RLS: the subquery runs under the
-- caller's own policies on documents, so case access is enforced in ONE place.
DROP POLICY IF EXISTS doc_classifications_select ON public.document_classifications;
CREATE POLICY doc_classifications_select ON public.document_classifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_classifications.document_id
    )
  );

-- Accept/reject updates come from authenticated advisors (the app layer gates
-- on upload/verify permission like re-categorizing does); same visibility rule.
DROP POLICY IF EXISTS doc_classifications_update ON public.document_classifications;
CREATE POLICY doc_classifications_update ON public.document_classifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_classifications.document_id
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_classifications.document_id
    )
  );

-- No INSERT/DELETE policies: rows are written by the service-role pipeline only.

-- -----------------------------------------------------------------------------
-- Include document_classifications in disaster-recovery backup/restore (mirrors
-- BACKUP_TABLES). Recreates restore_backup_snapshot (mig 220 body) with
-- document_classifications added to v_tables (after case_checklist_items — all
-- of its FK targets restore earlier). Not soft-deleted → not in the
-- deleted_at strip.
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
    'role_permissions', 'user_permission_overrides', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'case_checklist_items', 'document_classifications', 'case_expenses', 'case_fee_payments',
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

REVOKE ALL ON FUNCTION public.restore_backup_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(jsonb) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (232) ON CONFLICT DO NOTHING;
