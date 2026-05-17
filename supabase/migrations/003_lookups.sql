-- =============================================================================
-- Migration 003: Lookup Tables (Structure Only)
-- =============================================================================
-- Purpose: Create all lookup tables (statuses, banks, types, categories)
-- Dependencies: 001_setup.sql
-- Note: Seed data is in 004_lookups_seed.sql
-- =============================================================================

-- =============================================================================
-- Table: case_statuses
-- =============================================================================
-- 11 statuses from Kaufman's actual Excel
CREATE TABLE IF NOT EXISTS public.case_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  sort_order INT NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  default_duration_days INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_statuses_active ON public.case_statuses(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_case_statuses_sort ON public.case_statuses(sort_order);

CREATE TRIGGER trg_case_statuses_updated_at
  BEFORE UPDATE ON public.case_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_statuses ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: case_bank_statuses
-- =============================================================================
-- Per-bank status (separate from case status)
-- A case can be at "execution" status overall, but specific banks may be
-- "rejected", "pre_approved", etc.
CREATE TABLE IF NOT EXISTS public.case_bank_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_bank_statuses_active ON public.case_bank_statuses(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_case_bank_statuses_updated_at
  BEFORE UPDATE ON public.case_bank_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_bank_statuses ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: case_types
-- =============================================================================
-- 6 types from Kaufman: contractor / second_hand / refinance / transfer / any_purpose / renovation
CREATE TABLE IF NOT EXISTS public.case_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_types_active ON public.case_types(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_case_types_updated_at
  BEFORE UPDATE ON public.case_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_types ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: banks
-- =============================================================================
-- 7 banks: Mizrahi, Hapoalim, Leumi, Jerusalem, BTB, Discount, Albar
-- BTB and Albar are non_bank_lenders
CREATE TABLE IF NOT EXISTS public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888888',
  logo_url TEXT,
  lender_type TEXT NOT NULL DEFAULT 'bank' CHECK (lender_type IN ('bank', 'non_bank_lender')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banks_active ON public.banks(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_banks_updated_at
  BEFORE UPDATE ON public.banks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: income_types
-- =============================================================================
-- 10 types - includes Israel-specific: kollel_stipend, foreign_income
CREATE TABLE IF NOT EXISTS public.income_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_types_active ON public.income_types(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_income_types_updated_at
  BEFORE UPDATE ON public.income_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.income_types ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: document_categories
-- =============================================================================
-- Maps to one of 4 Google Drive folders: identity, income_il, income_abroad, insurance_collateral
CREATE TABLE IF NOT EXISTS public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  drive_folder TEXT NOT NULL CHECK (drive_folder IN ('identity', 'income_il', 'income_abroad', 'insurance_collateral')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_categories_active ON public.document_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_doc_categories_folder ON public.document_categories(drive_folder);

CREATE TRIGGER trg_doc_categories_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
