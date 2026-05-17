-- =============================================================================
-- Migration 011: Row Level Security Policies
-- =============================================================================
-- Purpose: Define RLS policies for all tables
-- Dependencies: All previous migrations (001-010)
-- Pattern:
--   - Lookups: read=authenticated, write=admin
--   - User data (profiles): read=own/admin, write=own/admin
--   - Business data (cases/leads/etc): respects has_permission()
-- =============================================================================

-- =============================================================================
-- Lookup Tables: Read for all, Write for admins
-- =============================================================================

-- roles
CREATE POLICY "roles_select" ON public.roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "roles_admin_all" ON public.roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- permissions
CREATE POLICY "permissions_select" ON public.permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "permissions_admin_all" ON public.permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- role_permissions
CREATE POLICY "role_permissions_select" ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_permissions_admin_all" ON public.role_permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_permission_overrides
CREATE POLICY "user_overrides_select_self_or_admin" ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_overrides_admin_all" ON public.user_permission_overrides FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- case_statuses, case_bank_statuses, case_types, banks, income_types, document_categories
CREATE POLICY "case_statuses_select" ON public.case_statuses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "case_statuses_admin_all" ON public.case_statuses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "case_bank_statuses_select" ON public.case_bank_statuses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "case_bank_statuses_admin_all" ON public.case_bank_statuses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "case_types_select" ON public.case_types FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "case_types_admin_all" ON public.case_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "banks_select" ON public.banks FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "banks_admin_all" ON public.banks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "income_types_select" ON public.income_types FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "income_types_admin_all" ON public.income_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "document_categories_select" ON public.document_categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "document_categories_admin_all" ON public.document_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- holidays
CREATE POLICY "holidays_select" ON public.holidays FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "holidays_admin_all" ON public.holidays FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- office_settings (single-row)
CREATE POLICY "office_settings_select" ON public.office_settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "office_settings_admin_update" ON public.office_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- case_type_documents (requirements config)
CREATE POLICY "case_type_documents_select" ON public.case_type_documents FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "case_type_documents_admin_all" ON public.case_type_documents FOR ALL TO authenticated
  USING (public.has_permission('manage_document_requirements')) WITH CHECK (public.has_permission('manage_document_requirements'));

-- reminder_rules
CREATE POLICY "reminder_rules_select" ON public.reminder_rules FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "reminder_rules_admin_all" ON public.reminder_rules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- Profiles: read own or admin, update own (limited) or admin
-- =============================================================================
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_permission('manage_users')) WITH CHECK (public.has_permission('manage_users'));

-- =============================================================================
-- Leads
-- =============================================================================
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('view_all_leads')
      OR (public.has_permission('view_own_leads') AND assigned_to = auth.uid())
    )
  );

CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('create_lead'));

CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_permission('edit_lead'))
  WITH CHECK (public.has_permission('edit_lead'));

CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
  USING (public.has_permission('delete_lead'));

-- =============================================================================
-- Cases
-- =============================================================================
CREATE POLICY "cases_select" ON public.cases FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('view_all_cases')
      OR (public.has_permission('view_own_cases') AND assigned_advisor_id = auth.uid())
      OR (is_archived = TRUE AND public.has_permission('view_archived_cases'))
    )
  );

CREATE POLICY "cases_insert" ON public.cases FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('create_case'));

CREATE POLICY "cases_update" ON public.cases FOR UPDATE TO authenticated
  USING (
    public.has_permission('edit_any_case')
    OR (public.has_permission('edit_own_case') AND assigned_advisor_id = auth.uid())
  )
  WITH CHECK (
    public.has_permission('edit_any_case')
    OR (public.has_permission('edit_own_case') AND assigned_advisor_id = auth.uid())
  );

CREATE POLICY "cases_delete" ON public.cases FOR DELETE TO authenticated
  USING (public.has_permission('delete_case'));

-- =============================================================================
-- case_borrowers, case_banks - cascade from cases
-- =============================================================================
CREATE POLICY "case_borrowers_via_case" ON public.case_borrowers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL));

CREATE POLICY "case_banks_via_case" ON public.case_banks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL));

-- =============================================================================
-- Borrowers + Incomes + Obligations
-- =============================================================================
-- Borrowers are visible if linked to a viewable case
CREATE POLICY "borrowers_select" ON public.borrowers FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.case_borrowers cb
      JOIN public.cases c ON c.id = cb.case_id
      WHERE cb.borrower_id = borrowers.id
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "borrowers_modify" ON public.borrowers FOR ALL TO authenticated
  USING (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
  WITH CHECK (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'));

-- Incomes: requires view_case_incomes + borrower access
CREATE POLICY "incomes_select" ON public.borrower_incomes FOR SELECT TO authenticated
  USING (
    public.has_permission('view_case_incomes')
    AND EXISTS (SELECT 1 FROM public.borrowers b WHERE b.id = borrower_id AND b.deleted_at IS NULL)
  );

CREATE POLICY "incomes_modify" ON public.borrower_incomes FOR ALL TO authenticated
  USING (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
  WITH CHECK (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'));

-- Obligations: requires view_case_obligations + borrower access
CREATE POLICY "obligations_select" ON public.borrower_obligations FOR SELECT TO authenticated
  USING (
    public.has_permission('view_case_obligations')
    AND EXISTS (SELECT 1 FROM public.borrowers b WHERE b.id = borrower_id AND b.deleted_at IS NULL)
  );

CREATE POLICY "obligations_modify" ON public.borrower_obligations FOR ALL TO authenticated
  USING (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
  WITH CHECK (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'));

-- =============================================================================
-- Documents
-- =============================================================================
CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('view_case_documents')
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL)
  );

CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('upload_document'));

CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated
  USING (public.has_permission('verify_document') OR public.has_permission('upload_document'))
  WITH CHECK (public.has_permission('verify_document') OR public.has_permission('upload_document'));

CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (public.has_permission('delete_document'));

-- =============================================================================
-- Tasks
-- =============================================================================
-- User sees own tasks + admin sees all
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.has_permission('view_all_cases')
  );

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.is_admin());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- =============================================================================
-- Stage Durations
-- =============================================================================
CREATE POLICY "stage_durations_select" ON public.stage_durations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL));

-- =============================================================================
-- Audit Log
-- =============================================================================
-- Read: anyone with view_audit_log permission
-- Write: ONLY via triggers (with SECURITY DEFINER)
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_permission('view_audit_log'));

-- No write policy = no direct writes (only triggers can write via SECURITY DEFINER)

-- =============================================================================
-- Import Jobs
-- =============================================================================
CREATE POLICY "import_jobs_select_own_or_admin" ON public.import_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "import_jobs_insert_own" ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "import_jobs_update_own_or_admin" ON public.import_jobs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
