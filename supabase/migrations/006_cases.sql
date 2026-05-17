-- =============================================================================
-- Migration 006: Cases + Case Banks (Borrowers Junction in 007)
-- =============================================================================
-- Purpose: Main case table + bank associations
-- Dependencies: 002_auth_core (profiles), 003_lookups (statuses, types, banks), 005_leads
-- =============================================================================

-- =============================================================================
-- Table: cases
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL DEFAULT public.generate_case_number(),
  case_type_primary_id UUID REFERENCES public.case_types(id),
  case_type_secondary_id UUID REFERENCES public.case_types(id),
  status_id UUID REFERENCES public.case_statuses(id),
  assigned_advisor_id UUID REFERENCES public.profiles(id),
  primary_borrower_id UUID, -- FK added after borrowers table created (007)
  property_value NUMERIC(15, 2),
  requested_mortgage_amount NUMERIC(15, 2),
  equity NUMERIC(15, 2),
  fee_amount NUMERIC(15, 2),
  expected_income NUMERIC(15, 2),
  request_details TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_advisor ON public.cases(assigned_advisor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_active ON public.cases(deleted_at, is_archived) WHERE deleted_at IS NULL AND is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_cases_archived ON public.cases(is_archived) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.cases.case_type_primary_id IS 'Primary case type (one of 6: contractor/second_hand/etc.)';
COMMENT ON COLUMN public.cases.case_type_secondary_id IS 'Secondary case type for combo scenarios (e.g., "contractor + renovation")';
COMMENT ON COLUMN public.cases.request_details IS 'Big free text field - the full story of the case';
COMMENT ON COLUMN public.cases.fee_amount IS 'Manager-only field (RLS will filter)';
COMMENT ON COLUMN public.cases.expected_income IS 'Manager-only field (RLS will filter)';

-- Now add the FK from leads.converted_to_case_id
ALTER TABLE public.leads
  ADD CONSTRAINT fk_leads_converted_case
  FOREIGN KEY (converted_to_case_id) REFERENCES public.cases(id) ON DELETE SET NULL;

-- =============================================================================
-- Table: case_banks (multi-bank support)
-- =============================================================================
-- A case can be submitted to multiple banks, each with its own status & banker
CREATE TABLE IF NOT EXISTS public.case_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id),
  bank_status_id UUID REFERENCES public.case_bank_statuses(id),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  banker_name TEXT,
  banker_phone TEXT,
  banker_email TEXT,
  submission_date DATE,
  response_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE (case_id, bank_id) -- One bank can only be added once per case
);

CREATE INDEX IF NOT EXISTS idx_case_banks_case ON public.case_banks(case_id);
CREATE INDEX IF NOT EXISTS idx_case_banks_bank ON public.case_banks(bank_id);
CREATE INDEX IF NOT EXISTS idx_case_banks_primary ON public.case_banks(case_id) WHERE is_primary = TRUE;

CREATE TRIGGER trg_case_banks_updated_at
  BEFORE UPDATE ON public.case_banks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_banks ENABLE ROW LEVEL SECURITY;

-- Trigger: ensure only one primary bank per case
CREATE OR REPLACE FUNCTION public.ensure_single_primary_bank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE public.case_banks
    SET is_primary = FALSE
    WHERE case_id = NEW.case_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_banks_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.case_banks
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION public.ensure_single_primary_bank();
