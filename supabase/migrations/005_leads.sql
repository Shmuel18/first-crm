-- =============================================================================
-- Migration 005: Leads
-- =============================================================================
-- Purpose: Lead management table
-- Dependencies: 002_auth_core.sql (profiles)
-- Note: All fields nullable except id (progressive validation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  national_id TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted')),
  converted_at TIMESTAMPTZ,
  converted_to_case_id UUID, -- FK added in 006_cases.sql to avoid circular dep
  assigned_to UUID REFERENCES public.profiles(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Indexes for duplicate detection and filtering
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_national_id ON public.leads(national_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON public.leads(status, assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_active ON public.leads(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.leads.notes IS 'Free text - source, referrer, request details all go here per Kaufman spec';
COMMENT ON COLUMN public.leads.status IS 'Only "active" or "converted" - no workflow statuses per spec';
