-- =============================================================================
-- Migration 009: Tasks + Reminder Rules + Stage Durations
-- =============================================================================
-- Purpose: Task management + automation rules + stage time tracking
-- Dependencies: 002_auth_core (profiles, roles), 005_leads, 006_cases (statuses)
-- =============================================================================

-- =============================================================================
-- Table: reminder_rules (admin-configurable automation)
-- =============================================================================
-- Defines when automatic tasks/notifications get created
CREATE TABLE IF NOT EXISTS public.reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'stage_duration_exceeded',
    'document_expiry_approaching',
    'lead_no_action',
    'task_overdue'
  )),
  trigger_params JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., {"status_id": "...", "days": 7}
  action_type TEXT NOT NULL DEFAULT 'create_task' CHECK (action_type IN ('create_task', 'send_notification', 'both')),
  assigned_to_role_id UUID REFERENCES public.roles(id),
  task_title_template TEXT,
  task_description_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_reminder_rules_active ON public.reminder_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reminder_rules_trigger ON public.reminder_rules(trigger_type);

CREATE TRIGGER trg_reminder_rules_updated_at
  BEFORE UPDATE ON public.reminder_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: tasks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  snoozed_until TIMESTAMPTZ,
  is_automated BOOLEAN NOT NULL DEFAULT FALSE,
  automation_rule_id UUID REFERENCES public.reminder_rules(id) ON DELETE SET NULL,
  google_calendar_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_case ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: stage_durations (auto-populated by trigger)
-- =============================================================================
-- Tracks how long each case spent in each status
-- Used for "stuck case" reminders and reporting
CREATE TABLE IF NOT EXISTS public.stage_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  status_id UUID NOT NULL REFERENCES public.case_statuses(id),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  duration_days INT, -- computed when exited
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_durations_case ON public.stage_durations(case_id);
CREATE INDEX IF NOT EXISTS idx_stage_durations_status ON public.stage_durations(status_id);
CREATE INDEX IF NOT EXISTS idx_stage_durations_current ON public.stage_durations(case_id) WHERE exited_at IS NULL;

ALTER TABLE public.stage_durations ENABLE ROW LEVEL SECURITY;

-- Trigger: when case status changes, close current stage_duration row and open new one
CREATE OR REPLACE FUNCTION public.track_stage_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only track if status actually changed
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    -- Close current open stage row
    UPDATE public.stage_durations
    SET
      exited_at = NOW(),
      duration_days = EXTRACT(DAY FROM (NOW() - entered_at))::INT
    WHERE case_id = NEW.id AND exited_at IS NULL;

    -- Open new stage row (if there's a new status)
    IF NEW.status_id IS NOT NULL THEN
      INSERT INTO public.stage_durations (case_id, status_id, entered_at)
      VALUES (NEW.id, NEW.status_id, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_track_stage_duration
  AFTER UPDATE OF status_id ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.track_stage_duration();

-- Also track stage on INSERT (first time the case has a status)
CREATE OR REPLACE FUNCTION public.initialize_stage_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    INSERT INTO public.stage_durations (case_id, status_id, entered_at)
    VALUES (NEW.id, NEW.status_id, NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_initialize_stage_duration
  AFTER INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_stage_duration();
