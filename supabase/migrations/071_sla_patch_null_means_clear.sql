-- =============================================================================
-- Migration 071: save_notification_settings — null-in-patch means "clear key"
-- =============================================================================
-- Migration 070 wrote the RPC with simple JSONB concat merge (`existing || patch`).
-- The patch from the form includes explicit `null` values for fields the
-- admin blanked (to clear a threshold). The old merge would store those
-- as JSON null inside the JSONB, which sanitizeThresholds drops on read
-- — visible behavior was OK but the column accumulates null entries.
--
-- Worse: the action sends the patch keyed by ACTIVE statuses only. An
-- absent key in the patch is supposed to mean "leave existing alone"
-- (so deactivated-status thresholds survive), while an explicit-null
-- value means "clear this active threshold". The old merge couldn't
-- distinguish the two — both ended up as identity.
--
-- This revision:
--   - For each key in p_sla, if value is JSON null → DELETE from existing
--   - For each key with a non-null value → SET (overwrite)
--   - Keys ABSENT from p_sla → untouched (preserves deactivated thresholds)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_notification_settings(
  p_email_task_assigned BOOLEAN,
  p_email_task_completed BOOLEAN,
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
  v_clear_keys TEXT[];
  v_set_patch JSONB;
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
      RETURN;
    END IF;

    IF jsonb_typeof(p_sla) <> 'object' THEN
      RAISE EXCEPTION 'p_sla must be a JSON object' USING ERRCODE = '22023';
    END IF;

    -- Lock the row so concurrent admin saves can't race.
    SELECT sla_status_thresholds INTO v_existing
      FROM public.office_settings
     WHERE id = 1
     FOR UPDATE;

    -- Separate the patch into "set these" + "clear these" sets.
    --   - clear keys: keys in p_sla whose value is JSON null
    --   - set patch: p_sla with the null entries stripped
    v_clear_keys := ARRAY(
      SELECT k FROM jsonb_each(p_sla) AS x(k, v) WHERE v = 'null'::jsonb
    );
    v_set_patch := jsonb_strip_nulls(p_sla);

    -- (existing - clear_keys) || set_patch
    --   1. Drop the keys the admin explicitly blanked
    --   2. Overwrite/set the keys with new values
    --   3. Keys ABSENT from p_sla are untouched in v_existing → preserved
    v_merged := (COALESCE(v_existing, '{}'::jsonb) - v_clear_keys) || v_set_patch;

    UPDATE public.office_settings
       SET sla_status_thresholds = v_merged,
           updated_by = v_actor
     WHERE id = 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'office_settings id=1 row missing' USING ERRCODE = 'P0002';
    END IF;
  END IF;
END;
$fn$;
