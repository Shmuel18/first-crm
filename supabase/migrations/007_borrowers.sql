-- =============================================================================
-- Migration 007: Borrowers + Incomes + Obligations
-- =============================================================================
-- Purpose: Borrower personal info + financial data
-- Dependencies: 002_auth_core, 003_lookups (income_types), 006_cases
-- Note: All fields nullable (progressive validation)
-- =============================================================================

-- =============================================================================
-- Table: borrowers
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  national_id TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'common_law')),
  children_count INT,
  address TEXT,
  citizenship TEXT,
  residency_type TEXT CHECK (residency_type IN ('resident', 'foreign_resident', 'returning_resident')),
  employment_status TEXT CHECK (employment_status IN ('employee', 'self_employed', 'unemployed', 'pensioner')),
  employer_name TEXT,
  credit_rating TEXT,
  owns_other_property BOOLEAN,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_borrowers_national_id ON public.borrowers(national_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_borrowers_phone ON public.borrowers(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_borrowers_active ON public.borrowers(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_borrowers_updated_at
  BEFORE UPDATE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;

-- Now add the FK from cases.primary_borrower_id
ALTER TABLE public.cases
  ADD CONSTRAINT fk_cases_primary_borrower
  FOREIGN KEY (primary_borrower_id) REFERENCES public.borrowers(id) ON DELETE SET NULL;

-- =============================================================================
-- Table: case_borrowers (M:N junction)
-- =============================================================================
-- A borrower can be on multiple cases (in theory)
-- A case has 1-N borrowers
-- Roles: borrower OR guarantor (no primary/secondary distinction per spec)
CREATE TABLE IF NOT EXISTS public.case_borrowers (
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  role_in_case TEXT NOT NULL DEFAULT 'borrower' CHECK (role_in_case IN ('borrower', 'guarantor')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, borrower_id)
);

CREATE INDEX IF NOT EXISTS idx_case_borrowers_borrower ON public.case_borrowers(borrower_id);
CREATE INDEX IF NOT EXISTS idx_case_borrowers_primary ON public.case_borrowers(case_id) WHERE is_primary = TRUE;

ALTER TABLE public.case_borrowers ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: borrower_incomes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.borrower_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  income_type_id UUID REFERENCES public.income_types(id),
  amount_monthly NUMERIC(15, 2),
  source_name TEXT, -- employer name / property address / etc.
  tenure_months INT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_incomes_borrower ON public.borrower_incomes(borrower_id);

CREATE TRIGGER trg_incomes_updated_at
  BEFORE UPDATE ON public.borrower_incomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.borrower_incomes ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.borrower_incomes.amount_monthly IS 'Usually NET amount (per Kaufman spec)';

-- =============================================================================
-- Table: borrower_obligations
-- =============================================================================
-- No obligation_type lookup - categorization is done via free text in description
-- Per Kaufman: "no need for category, just free text"
CREATE TABLE IF NOT EXISTS public.borrower_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  loan_amount NUMERIC(15, 2),       -- Current or original (per available info)
  monthly_payment NUMERIC(15, 2),
  months_remaining INT,
  end_date DATE,
  lender TEXT,                      -- Where the loan is (bank/lender/person name)
  description TEXT,                 -- Free text - what is the obligation
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_obligations_borrower ON public.borrower_obligations(borrower_id);

CREATE TRIGGER trg_obligations_updated_at
  BEFORE UPDATE ON public.borrower_obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.borrower_obligations ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.borrower_obligations.description IS 'Free text per spec - replaces obligation_type lookup table';
COMMENT ON COLUMN public.borrower_obligations.months_remaining IS 'Computed mutual with end_date by app layer';
