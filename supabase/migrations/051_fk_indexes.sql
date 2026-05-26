-- =============================================================================
-- Migration 051: Add missing foreign-key indexes
-- =============================================================================
-- Migration 042 added FK indexes for the cases table. The audit found ~20
-- more missing across profile-referencing FKs on leads, borrowers, incomes,
-- obligations, documents, tasks, notifications, and audit_log.
--
-- Why this matters: when a profiles row is deleted (ON DELETE CASCADE from
-- auth.users), Postgres has to scan every referencing table to enforce the
-- FK. Without indexes, that's a sequential scan on each. Slow user removal
-- + lock contention.
--
-- All CREATE INDEX statements use IF NOT EXISTS so re-running is safe.
-- Each is non-unique because the referenced column isn't unique in context.
-- =============================================================================

-- Leads: created_by, updated_by, assigned_to
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_updated_by ON public.leads(updated_by);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

-- Borrowers: created_by, updated_by
CREATE INDEX IF NOT EXISTS idx_borrowers_created_by ON public.borrowers(created_by);
CREATE INDEX IF NOT EXISTS idx_borrowers_updated_by ON public.borrowers(updated_by);

-- Documents: uploaded_by, verified_by
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_verified_by ON public.documents(verified_by);

-- Borrower incomes: created_by, updated_by
CREATE INDEX IF NOT EXISTS idx_borrower_incomes_created_by ON public.borrower_incomes(created_by);
CREATE INDEX IF NOT EXISTS idx_borrower_incomes_updated_by ON public.borrower_incomes(updated_by);

-- Borrower obligations: created_by, updated_by
CREATE INDEX IF NOT EXISTS idx_borrower_obligations_created_by ON public.borrower_obligations(created_by);
CREATE INDEX IF NOT EXISTS idx_borrower_obligations_updated_by ON public.borrower_obligations(updated_by);

-- Tasks: completed_by, created_by, updated_by, automation_rule_id
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON public.tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_by ON public.tasks(updated_by);
CREATE INDEX IF NOT EXISTS idx_tasks_automation_rule_id ON public.tasks(automation_rule_id);

-- Notifications: actor_id, case_id, task_id
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_case_id ON public.notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON public.notifications(task_id);

-- Audit log: composite for the common "show history for record X in table T" query
CREATE INDEX IF NOT EXISTS idx_audit_log_user_record
  ON public.audit_log(user_id, table_name, record_id);

-- Fix the stale partial index from migration 009 — added in 032 when
-- 'in_progress' became a valid task status, but the index predicate was
-- never updated to include it. Kanban filters that hit `WHERE status IN
-- ('pending', 'in_progress')` then full-scan the in_progress side.
DROP INDEX IF EXISTS public.idx_tasks_due;
CREATE INDEX idx_tasks_due ON public.tasks(due_date)
  WHERE status IN ('pending', 'in_progress');
