-- =============================================================================
-- Migration 010: Office Settings + Holidays + Audit Log + Import Jobs
-- =============================================================================
-- Purpose: System-level tables (config, holidays, history, import)
-- Dependencies: 002_auth_core (profiles)
-- =============================================================================

-- =============================================================================
-- Table: office_settings (single row, id always 1)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.office_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Office info
  office_name TEXT NOT NULL DEFAULT 'Kaufman Finance Group',
  office_logo_url TEXT,
  office_tagline TEXT,
  -- Contact
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  phone_main TEXT,
  phone_fax TEXT,
  email_main TEXT,
  website_url TEXT,
  -- Tax & Banking (for invoices)
  tax_id TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_account_bank TEXT,
  bank_account_branch TEXT,
  -- Design
  primary_color TEXT NOT NULL DEFAULT '#0A0A0A',
  secondary_color TEXT NOT NULL DEFAULT '#C9A961',
  email_header_image_url TEXT,
  -- Working Hours
  working_hours_start TIME NOT NULL DEFAULT '08:00',
  working_hours_end TIME NOT NULL DEFAULT '18:00',
  working_days JSONB NOT NULL DEFAULT '["sun","mon","tue","wed","thu"]'::jsonb,
  -- Format
  default_language TEXT NOT NULL DEFAULT 'he' CHECK (default_language IN ('he', 'en')),
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  currency TEXT NOT NULL DEFAULT 'ILS',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  -- Defaults for tasks/reminders
  default_task_time TIME NOT NULL DEFAULT '09:00',
  task_reminder_days_before INT NOT NULL DEFAULT 1,
  document_expiry_warning_days INT NOT NULL DEFAULT 14,
  -- Email Config
  email_sender_name TEXT,
  email_sender_address TEXT,
  email_reply_to_address TEXT,
  email_service_provider TEXT NOT NULL DEFAULT 'resend',
  -- History Retention
  audit_log_retention_days INT NOT NULL DEFAULT 365,
  deleted_records_retention_days INT NOT NULL DEFAULT 14,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE TRIGGER trg_office_settings_updated_at
  BEFORE UPDATE ON public.office_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

-- Initial row
INSERT INTO public.office_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Table: holidays
-- =============================================================================
-- Used to skip notifications/reminders on Shabbat and holidays
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  date DATE NOT NULL,
  year INT NOT NULL,
  is_work_day BOOLEAN NOT NULL DEFAULT FALSE,
  skip_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, name_he)
);

CREATE INDEX IF NOT EXISTS idx_holidays_year ON public.holidays(year);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_skip ON public.holidays(date) WHERE skip_reminders = TRUE;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: audit_log
-- =============================================================================
-- Tracks all changes to main entities (cases, leads, borrowers, etc.)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE')),
  changed_fields JSONB,
  user_id UUID REFERENCES public.profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_log(timestamp DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: import_jobs
-- =============================================================================
-- Tracks Excel/CSV imports for cases, leads, users
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('cases', 'leads', 'borrowers', 'users')),
  file_name TEXT NOT NULL,
  file_size BIGINT,
  column_mapping JSONB, -- saved mappings for reuse
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  total_rows INT,
  success_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,
  errors JSONB, -- array of {row, field, error}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON public.import_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
