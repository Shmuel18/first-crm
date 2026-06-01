-- =============================================================================
-- Migration 110: Insurance agent + appraiser name on cases (admin block)
-- =============================================================================
-- Two free-text fields requested for the admin block's "פרטי התיק" section:
--   - insurance_agent_name (שם סוכן הביטוח) - the insurance agent on the case
--   - appraiser_name        (שם שמאי)        - the property appraiser on the case
-- Both are optional free text, mirroring referrer_name (migration 016).
-- =============================================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS insurance_agent_name TEXT;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS appraiser_name TEXT;

COMMENT ON COLUMN public.cases.insurance_agent_name IS 'Free text - name of the insurance agent (סוכן ביטוח) handling the case insurance';
COMMENT ON COLUMN public.cases.appraiser_name IS 'Free text - name of the property appraiser (שמאי) on the case';
