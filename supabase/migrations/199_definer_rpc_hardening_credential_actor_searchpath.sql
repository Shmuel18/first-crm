-- =============================================================================
-- Migration 199: SECURITY DEFINER / INVOKER hardening — strip a credential from
--                the layout envelope, trust auth.uid() for bank attribution, pin
--                search_path on the audit guard (Theme: rounds 19-20 Bucket 1)
-- =============================================================================
-- Three independent hardening fixes, each a CREATE OR REPLACE of the effective-
-- latest body (pulled verbatim from the live catalog) with ONE surgical change:
--
--   * RPC-3  layout_bootstrap (was mig 088): serialized the WHOLE profiles row
--     via to_jsonb(p), including the encrypted google_calendar_refresh_token
--     credential column, into the bootstrap envelope returned on every page
--     load. Not exposed to the browser today (the TS mapper allowlists only
--     first_name/last_name/phone/email/language/role) but one careless mapper
--     edit from a leak. Fix: subtract the credential column from the JSONB. The
--     consumer reads none of the other columns, so this is zero-regression.
--
--   * RPC-2  set_primary_bank (was mig 118): SECURITY INVOKER, trusted a
--     client-supplied p_user_id for created_by/updated_by attribution and had
--     no SET search_path. A direct PostgREST call could stamp another user's id
--     as the editor (the row write itself stays RLS-gated by can_edit_case, so
--     no cross-case write — attribution spoofing only). Fix: assert
--     auth.uid() = p_user_id (mirrors soft_delete_document_with_tombstone,
--     mig 192) so the param is provably the real actor, and pin SET search_path.
--     Signature unchanged -> no call-site / database.ts change (the action
--     already passes the session id, so the happy path is untouched).
--
--   * AUDIT-BLOCK  audit_log_block_mutations (was mig 133): the audit_log
--     immutability trigger was the lone function in the audit/retention surface
--     with no SET search_path. SECURITY INVOKER + built-in calls only, so no
--     exploit today; pin it for consistency and future-proofing.
--
-- DEFERRED (not in this migration): AUTH-03 (REVOKE has_permission/is_admin from
-- PUBLIC/anon). Live-catalog audit showed all 83 RLS policies that reference them
-- are roles={authenticated} (anon never evaluates them via RLS), AND three
-- anon-executable SECURITY INVOKER functions (can_view_case,
-- cases_dashboard_bootstrap, upsert_case_financials) call them internally. Since
-- both helpers key off auth.uid() (NULL for anon -> already return false
-- harmlessly), revoking from anon yields ~zero security benefit against real
-- "permission denied" breakage risk on those entangled functions. Left as-is.
--
-- Idempotent (CREATE OR REPLACE). No code change. Deps: 088, 118, 133.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RPC-3: layout_bootstrap — strip the encrypted credential column
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.layout_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_profile JSONB;
  v_role JSONB;
  v_is_admin BOOLEAN;
  v_pending_tasks INT;
  v_critical_tasks INT;
  v_unread INT;
  v_recent_notifications JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  -- Subtract the encrypted OAuth refresh token: it must never cross the
  -- DB -> server boundary (the TS mapper allowlists named fields and never
  -- reads it, so removing it changes nothing the layout consumes).
  SELECT to_jsonb(p) - 'google_calendar_refresh_token'
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = v_actor;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'name_he', r.name_he,
    'name_en', r.name_en
  ) INTO v_role
    FROM public.roles r
   WHERE r.id = (v_profile ->> 'role_id')::UUID;

  v_is_admin := public.is_admin();

  SELECT COUNT(*) INTO v_pending_tasks
    FROM public.tasks
   WHERE assigned_to = v_actor
     AND status = 'pending'
     AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_critical_tasks
    FROM public.tasks
   WHERE assigned_to = v_actor
     AND priority = 'critical'
     AND status IN ('pending', 'in_progress')
     AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_unread
    FROM public.notifications
   WHERE user_id = v_actor
     AND read_at IS NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(n) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO v_recent_notifications
    FROM (
      SELECT id, user_id, actor_id, type, case_id, task_id, data, read_at, created_at
        FROM public.notifications
       WHERE user_id = v_actor
       ORDER BY created_at DESC
       LIMIT 15
    ) n;

  RETURN jsonb_build_object(
    'authenticated', true,
    'is_admin', v_is_admin,
    'pending_tasks', v_pending_tasks,
    'critical_tasks', v_critical_tasks,
    'unread_notifications', v_unread,
    'profile', COALESCE(v_profile, '{}'::jsonb) || jsonb_build_object('role', v_role),
    'recent_notifications', v_recent_notifications
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- RPC-2: set_primary_bank — assert actor = auth.uid(), pin search_path
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_primary_bank(p_case_id uuid, p_bank_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  target_id UUID;
BEGIN
  -- Attribution integrity: the caller cannot stamp another user's id.
  -- (The row write stays RLS-gated by can_edit_case; this only prevents
  -- forging created_by/updated_by on a direct PostgREST call.)
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'set_primary_bank: actor mismatch' USING ERRCODE = '42501';
  END IF;

  -- Clear current active primary rows only. Soft-deleted rows should stay
  -- invisible and untouched.
  UPDATE public.case_banks
    SET is_primary = FALSE,
        updated_by = p_user_id
    WHERE case_id = p_case_id
      AND is_primary = TRUE
      AND deleted_at IS NULL;

  IF p_bank_id IS NULL THEN
    RETURN;
  END IF;

  -- Prefer an existing active link. This avoids touching any soft-deleted
  -- duplicate and cannot trip uq_case_banks_active.
  SELECT id INTO target_id
    FROM public.case_banks
   WHERE case_id = p_case_id
     AND bank_id = p_bank_id
     AND deleted_at IS NULL
   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
   LIMIT 1;

  IF target_id IS NOT NULL THEN
    UPDATE public.case_banks
      SET is_primary = TRUE,
          updated_by = p_user_id
      WHERE id = target_id;
    RETURN;
  END IF;

  -- No active link exists. Reactivate one soft-deleted link if present.
  SELECT id INTO target_id
    FROM public.case_banks
   WHERE case_id = p_case_id
     AND bank_id = p_bank_id
     AND deleted_at IS NOT NULL
   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
   LIMIT 1;

  IF target_id IS NOT NULL THEN
    UPDATE public.case_banks
      SET is_primary = TRUE,
          deleted_at = NULL,
          updated_by = p_user_id
      WHERE id = target_id;
    RETURN;
  END IF;

  INSERT INTO public.case_banks (case_id, bank_id, is_primary, created_by, updated_by)
  VALUES (p_case_id, p_bank_id, TRUE, p_user_id, p_user_id);
END;
$function$;

-- -----------------------------------------------------------------------------
-- AUDIT-BLOCK: audit_log_block_mutations — pin search_path (body byte-identical)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_block_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF coalesce(current_setting('app.purge_audit', true), 'off') = 'on'
     OR coalesce(current_setting('app.redact_audit', true), 'off') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_log rows are immutable (operation: %)', TG_OP
    USING HINT = 'Sanctioned paths only: cleanup_old_audit_logs (purge) and audit_redact_on_hard_delete (PII erasure).';
END;
$function$;

INSERT INTO public.schema_version (version) VALUES (199) ON CONFLICT DO NOTHING;
