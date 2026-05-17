-- =============================================================================
-- Migration 008: Documents + Requirements
-- =============================================================================
-- Purpose: Document storage + per-case-type requirements
-- Dependencies: 002_auth_core, 003_lookups (document_categories, case_types, case_statuses), 006_cases, 007_borrowers
-- =============================================================================

-- =============================================================================
-- Table: documents
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.document_categories(id),
  file_name TEXT NOT NULL,
  drive_file_id TEXT,
  drive_file_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.profiles(id),
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'verified', 'rejected', 'expired')),
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_borrower ON public.documents(borrower_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON public.documents(expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: case_type_documents (junction - requirements config)
-- =============================================================================
-- Defines which document categories are required/recommended per case type
-- Admin can edit this from UI
CREATE TABLE IF NOT EXISTS public.case_type_documents (
  case_type_id UUID NOT NULL REFERENCES public.case_types(id) ON DELETE CASCADE,
  document_category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = required, FALSE = recommended only
  required_at_stage_id UUID REFERENCES public.case_statuses(id),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_type_id, document_category_id)
);

CREATE INDEX IF NOT EXISTS idx_case_type_docs_case_type ON public.case_type_documents(case_type_id);
CREATE INDEX IF NOT EXISTS idx_case_type_docs_category ON public.case_type_documents(document_category_id);

CREATE TRIGGER trg_case_type_documents_updated_at
  BEFORE UPDATE ON public.case_type_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_type_documents ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.case_type_documents IS 'Admin-editable: defines required/recommended docs per case type. Used for UI checklist warnings.';
