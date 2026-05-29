-- =============================================================================
-- Migration 094: Simulator regulatory thresholds on office_settings
-- =============================================================================

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS regulatory_thresholds JSONB NOT NULL DEFAULT '{
    "maxLtvPct": {"first_home": 75, "replacement": 70, "investment": 50},
    "minFixedPct": 33.3334,
    "maxPrimePct": 66.6667,
    "maxEqualPrincipalPct": 30,
    "maxTermMonths": 360
  }'::jsonb;

ALTER TABLE public.office_settings
  DROP CONSTRAINT IF EXISTS office_settings_regulatory_thresholds_is_object;

ALTER TABLE public.office_settings
  ADD CONSTRAINT office_settings_regulatory_thresholds_is_object
  CHECK (jsonb_typeof(regulatory_thresholds) = 'object');

CREATE OR REPLACE FUNCTION public.save_regulatory_thresholds(p_thresholds JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_thresholds IS NULL OR jsonb_typeof(p_thresholds) <> 'object' THEN
    RAISE EXCEPTION 'invalid thresholds' USING ERRCODE = '22023';
  END IF;

  UPDATE public.office_settings
     SET regulatory_thresholds = p_thresholds,
         updated_by = v_actor
   WHERE id = 1;
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_regulatory_thresholds(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_regulatory_thresholds(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_office_settings_regulatory_thresholds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF OLD.regulatory_thresholds IS NOT DISTINCT FROM NEW.regulatory_thresholds THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    user_id,
    changed_fields,
    ip_address,
    user_agent
  ) VALUES (
    'office_settings',
    '00000000-0000-0000-0000-000000000001',
    'UPDATE',
    NEW.updated_by,
    jsonb_build_object(
      'regulatory_thresholds',
      jsonb_build_object('old', OLD.regulatory_thresholds, 'new', NEW.regulatory_thresholds)
    ),
    current_setting('app.audit_ip', true),
    current_setting('app.audit_user_agent', true)
  );

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_office_settings_regulatory_thresholds ON public.office_settings;
CREATE TRIGGER trg_audit_office_settings_regulatory_thresholds
  AFTER UPDATE ON public.office_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_office_settings_regulatory_thresholds();

