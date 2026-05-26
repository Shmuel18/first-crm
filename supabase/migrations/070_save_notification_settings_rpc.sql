-- =============================================================================
-- Migration 070: save_notification_settings — atomic prefs + SLA write
-- =============================================================================
-- Fixes two review findings on the unified /settings/notifications save:
--
--   Finding #1 — Partial save: the old TS action called
--     updateMyNotificationPreferences() THEN supabase.update(office_settings).
--     If the SLA UPDATE failed (RLS or transient), the prefs upsert had
--     already committed → user saw "save failed" but their email-toggle
--     change persisted. The doc-comment promised atomicity; the code didn't
--     deliver. This RPC wraps both writes in a single PL/pgSQL function so
--     a SLA write failure raises and aborts the entire transaction, leaving
--     prefs untouched.
--
--   Finding #2 — Wipe on save: the old code did
--     `update office_settings set sla_status_thresholds = <new>`, replacing
--     the whole JSONB. Any threshold whose status had since been deactivated
--     (the form filters is_active=true → those keys don't appear in p_sla)
--     got silently dropped. This RPC merges with the existing JSONB so
--     deactivated-status thresholds survive a save round-trip.
--
-- Admin gating: SLA write is admin-only at the DB layer too — even if a
-- non-admin smuggles p_sla, the RPC ignores it. This mirrors the existing
-- has_permission('edit_office_settings') gate on direct UPDATEs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_notification_settings(
  p_email_task_assigned BOOLEAN,
  p_email_task_completed BOOLEAN,
  -- NULL = caller is not an admin / didn't submit SLA fields. NOT NULL +
  -- caller is admin → merged into the existing JSONB.
  p_sla JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_existing JSONB;
  v_merged JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- ── 1. Email preferences (everyone) ──────────────────────────────────
  INSERT INTO public.notification_preferences (
    user_id, email_task_assigned, email_task_completed
  ) VALUES (
    v_actor, p_email_task_assigned, p_email_task_completed
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email_task_assigned = EXCLUDED.email_task_assigned,
        email_task_completed = EXCLUDED.email_task_completed,
        updated_at = now();

  -- ── 2. SLA thresholds (admin only) ───────────────────────────────────
  IF p_sla IS NOT NULL THEN
    v_is_admin := public.is_admin();
    IF NOT v_is_admin THEN
      -- Non-admin smuggled p_sla in the request. Silently ignore — don't
      -- raise, so an over-eager client doesn't 5xx; prefs still saved.
      RETURN;
    END IF;

    -- Shape guard: same as the column CHECK, surface a clearer error.
    IF jsonb_typeof(p_sla) <> 'object' THEN
      RAISE EXCEPTION 'p_sla must be a JSON object' USING ERRCODE = '22023';
    END IF;

    -- Merge: read existing → apply incoming patch → write back. Preserves
    -- threshold values for any status that was active when set but is now
    -- deactivated (and therefore absent from the form's input set). The
    -- caller's p_sla is the authoritative source for keys it includes;
    -- anything missing from p_sla is left as-is in the stored JSONB.
    SELECT sla_status_thresholds INTO v_existing
      FROM public.office_settings
     WHERE id = 1
     FOR UPDATE; -- row-lock so concurrent admin saves can't race

    v_merged := COALESCE(v_existing, '{}'::jsonb) || p_sla;

    UPDATE public.office_settings
       SET sla_status_thresholds = v_merged,
           updated_by = v_actor
     WHERE id = 1;

    -- If the row is somehow gone (shouldn't be — migration 010 seeds id=1),
    -- the UPDATE silently no-ops. Raise so the caller sees the missing-row
    -- condition rather than masking it as a successful save.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'office_settings id=1 row missing' USING ERRCODE = 'P0002';
    END IF;
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.save_notification_settings(BOOLEAN, BOOLEAN, JSONB)
  TO authenticated;
