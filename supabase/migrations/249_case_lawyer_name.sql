-- =============================================================================
-- Migration 249: Lawyer name on cases (admin block)
-- =============================================================================
-- Free-text שם עו"ד for the admin block's "פרטי התיק" section, requested by
-- the office. Optional, mirrors insurance_agent_name / appraiser_name
-- (migration 110). Nullable with no default → metadata-only ALTER, no rewrite.
-- =============================================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS lawyer_name TEXT;

COMMENT ON COLUMN public.cases.lawyer_name IS 'Free text - name of the lawyer (עו"ד) on the case';

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (249) ON CONFLICT DO NOTHING;
