-- =============================================================================
-- Migration 184: optional Gush/Helka (block/parcel) on properties
-- =============================================================================
-- Israeli land-registry identifier (גוש/חלקה). Optional, free-text — "not
-- always needed" — so a single nullable TEXT column, no structure/constraint.
-- Added to BOTH the primary property (cases) and additional properties
-- (case_properties, migration 156), since the property block's field row is
-- shared between them.
-- =============================================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS gush_helka TEXT;

ALTER TABLE public.case_properties
  ADD COLUMN IF NOT EXISTS gush_helka TEXT;

INSERT INTO public.schema_version (version) VALUES (184) ON CONFLICT DO NOTHING;
