-- 252 — a directory of the office's professionals: appraisers, lawyers and
-- insurance agents (שמאים / עורכי דין / סוכני ביטוח).
--
-- The office keeps these names in a spreadsheet and types them into the case's
-- free-text fields (insurance_agent_name, appraiser_name, lawyer_name). This
-- table backs a Settings screen, name suggestions on those fields, and a
-- "send" action that mails / WhatsApps a contact the case details. The case
-- fields stay free text on purpose — a one-off name still fits.
--
-- Read: any signed-in staff member. Write: manage_lookups (role-configurable).
-- Soft delete, like every other office-owned list. Joins the backup + restore
-- allowlists (the drift test requires both).

CREATE TABLE IF NOT EXISTS public.professional_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL
                CONSTRAINT professional_contacts_kind_check
                CHECK (kind IN ('appraiser', 'lawyer', 'insurance_agent')),
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  phone       TEXT CHECK (phone IS NULL OR length(phone) <= 40),
  whatsapp    TEXT CHECK (whatsapp IS NULL OR length(whatsapp) <= 40),
  email       TEXT CHECK (email IS NULL OR length(email) <= 254),
  company     TEXT CHECK (company IS NULL OR length(company) <= 120),
  notes       TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_professional_contacts_kind
  ON public.professional_contacts(kind, name)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_professional_contacts_updated_at ON public.professional_contacts;
CREATE TRIGGER trg_professional_contacts_updated_at
  BEFORE UPDATE ON public.professional_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.professional_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professional_contacts_select" ON public.professional_contacts;
CREATE POLICY "professional_contacts_select" ON public.professional_contacts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "professional_contacts_insert" ON public.professional_contacts;
CREATE POLICY "professional_contacts_insert" ON public.professional_contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('manage_lookups'));

DROP POLICY IF EXISTS "professional_contacts_update" ON public.professional_contacts;
CREATE POLICY "professional_contacts_update" ON public.professional_contacts
  FOR UPDATE TO authenticated
  USING (public.has_permission('manage_lookups') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('manage_lookups') AND deleted_at IS NULL);

GRANT SELECT, INSERT, UPDATE ON public.professional_contacts TO authenticated;

-- Soft delete through a definer RPC: a plain UPDATE that sets deleted_at is
-- refused by RLS, because the SELECT policy hides deleted rows (same pattern
-- as soft_delete_case_property, migration 156).
CREATE OR REPLACE FUNCTION public.soft_delete_professional_contact(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('manage_lookups') THEN
    RAISE EXCEPTION 'soft_delete_professional_contact: not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.professional_contacts
     SET deleted_at = now(), updated_by = auth.uid()
   WHERE id = p_id AND deleted_at IS NULL;
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_professional_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_professional_contact(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Restore allowlist — restated from migration 242 with professional_contacts
-- appended (both lists). Body otherwise unchanged.
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
    'time_entries', 'employee_pay_rates', 'checklist_templates',
    'message_templates', 'system_email_templates', 'notification_preferences',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history', 'task_comments',
    'task_attachments',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks',
    'professional_contacts'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks', 'case_expenses', 'case_fee_payments', 'task_comments',
    'case_properties', 'case_payouts', 'maaser_payments', 'maaser_ledger_entries', 'time_entries', 'message_templates',
    'professional_contacts'
  ];
  v_tbl text;
  v_rows jsonb;
  v_inserted bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_owner() THEN
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

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (252) ON CONFLICT DO NOTHING;
