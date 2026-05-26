-- =============================================================================
-- Migration 072: Audit-trail for office_settings.sla_status_thresholds
-- =============================================================================
-- Migration 012 deliberately skipped office_settings from the global audit
-- trigger ("changes infrequent"). For SLA thresholds, that's the wrong
-- trade-off — these settings gate office-wide overdue-case alerts, and
-- the compliance question "who turned off the document_collection alarm
-- and when" needs an auditable answer.
--
-- This adds a focused trigger that logs JUST the sla_status_thresholds
-- column when it changes — using the same audit_log table + same
-- changed_fields shape the rest of the app uses.
--
-- Reads: NOT restricted. SLA thresholds drive notifications for ALL users
-- (an advisor benefits from knowing "after 7 days I'll get pinged about
-- this case"). Threat model is unauthorized WRITES (already gated by
-- office_settings_admin_update RLS + the SECURITY DEFINER RPC's
-- is_admin() check) and audit trail of WRITES — both handled here.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_office_settings_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  -- Only log if the SLA-thresholds column actually changed. Other column
  -- writes (office_name, address, etc.) don't go through this trigger.
  IF NEW.sla_status_thresholds IS NOT DISTINCT FROM OLD.sla_status_thresholds THEN
    RETURN NEW;
  END IF;

  -- Capture per-request IP / user-agent if the PostgREST hook set them.
  BEGIN
    v_ip := current_setting('app.audit_ip', true);
    v_ua := current_setting('app.audit_user_agent', true);
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  INSERT INTO public.audit_log (
    table_name, record_id, action, changed_fields, user_id, ip_address, user_agent
  ) VALUES (
    'office_settings',
    -- office_settings is a singleton; use a stable record_id (the row's id
    -- column is an integer 1, audit_log.record_id is UUID — use a zero UUID
    -- as the conventional "global config" record id, matching the pattern
    -- used elsewhere for non-UUID-keyed records).
    '00000000-0000-0000-0000-000000000000'::UUID,
    'UPDATE',
    jsonb_build_object(
      'sla_status_thresholds', jsonb_build_object(
        'old', OLD.sla_status_thresholds,
        'new', NEW.sla_status_thresholds
      )
    ),
    -- updated_by is the actor we have available; the global audit_log_change
    -- trigger reads auth.uid() but we use the column for consistency with
    -- the office-settings update RPC which stamps updated_by.
    NEW.updated_by,
    v_ip,
    v_ua
  );

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_office_settings_sla ON public.office_settings;
CREATE TRIGGER trg_audit_office_settings_sla
  AFTER UPDATE ON public.office_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_office_settings_sla();
