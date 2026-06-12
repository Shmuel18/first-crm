-- =============================================================================
-- Migration 169: permissions-system protection trio (R3-roles-1 + R3-roles-2)
-- =============================================================================
-- Three structural guarantees for the configurable-permissions system, chosen
-- DELIBERATELY over an is_admin short-circuit inside has_permission — that
-- alternative would have silently disabled per-user overrides that BLOCK a
-- permission from a specific admin, which is a designed capability (overrides
-- take first precedence for every user, admins included).
--
-- (1) ADMIN-ROLE ROW GUARD: the admin role's permission set is "fixed" per the
--     spec, but until now only a TypeScript check enforced it — any admin JWT
--     could PATCH /rest/v1/role_permissions for the admin role directly via
--     PostgREST. A BEFORE trigger now rejects end-user (authenticated/anon)
--     writes to the admin role's rows. service_role (backup restore) and
--     direct SQL (migrations, recovery psql) remain allowed.
--
-- (2) AUTO-GRANT NEW PERMISSIONS TO ADMIN: the admin's all-permissions state
--     was pure seed data — every future `INSERT INTO permissions` migration
--     had to remember a manual re-grant (095 did; others may forget, silently
--     denying managers the new capability). An AFTER INSERT trigger on
--     permissions now grants each new permission to the admin role
--     automatically.
--
-- (3) AUDIT: role_permissions and user_permission_overrides had NO audit
--     triggers — the most security-sensitive admin mutation in the app was
--     unattributable. Both tables lack an `id` column (composite PKs), so the
--     generic audit_log_change() (which reads NEW.id) cannot be attached; a
--     dedicated function records them with record_id = role_id / user_id.
--     ip/user-agent arrive automatically via the mig-047 pre-request hook.
-- =============================================================================

-- ---- (1) Admin-role row guard ----------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_admin_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid := COALESCE(NEW.role_id, OLD.role_id);
  v_jwt_role text := auth.role();
BEGIN
  -- Block only end-user JWT contexts. service_role (restore) and direct SQL
  -- (migrations / recovery, where auth.role() is NULL) stay allowed.
  IF v_jwt_role IN ('authenticated', 'anon') AND EXISTS (
    SELECT 1 FROM public.roles r WHERE r.id = v_role_id AND r.key = 'admin'
  ) THEN
    RAISE EXCEPTION 'the admin role permission set is fixed'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_guard_admin_role_permissions
  BEFORE INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_permissions();

-- ---- (2) Auto-grant new permissions to the admin role ------------------------
CREATE OR REPLACE FUNCTION public.grant_new_permission_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
  SELECT r.id, NEW.id, TRUE
    FROM public.roles r
   WHERE r.key = 'admin'
  ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = TRUE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_new_permission_to_admin ON public.permissions;
CREATE TRIGGER trg_grant_new_permission_to_admin
  AFTER INSERT ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.grant_new_permission_to_admin();

-- Backfill: make the auto-grant invariant true for every EXISTING permission
-- too (idempotent; fixes any historical seed omissions in one shot).
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, TRUE
  FROM public.roles r
  CROSS JOIN public.permissions p
 WHERE r.key = 'admin'
ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = TRUE;

-- ---- (3) Audit triggers for the permission tables ----------------------------
-- Dedicated function: these tables have composite PKs (no `id`), so the
-- generic audit_log_change() cannot be reused. record_id carries the row's
-- "subject" (role_id / user_id); the full row or per-field diff lands in
-- changed_fields exactly like the generic function's shape, so the existing
-- audit parser renders it with no changes.
CREATE OR REPLACE FUNCTION public.audit_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_data JSONB;
  action_type TEXT;
  record_id_value UUID;
BEGIN
  IF TG_TABLE_NAME = 'role_permissions' THEN
    record_id_value := COALESCE(NEW.role_id, OLD.role_id);
  ELSE
    record_id_value := COALESCE(NEW.user_id, OLD.user_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    action_type := 'INSERT';
    changed_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'UPDATE';
    SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
    INTO changed_data
    FROM (
      SELECT
        key,
        (to_jsonb(OLD) -> key) AS old_val,
        (to_jsonb(NEW) -> key) AS new_val
      FROM jsonb_object_keys(to_jsonb(NEW)) AS key
      WHERE (to_jsonb(OLD) -> key) IS DISTINCT FROM (to_jsonb(NEW) -> key)
        AND key NOT IN ('updated_at')
    ) sub
    WHERE old_val IS DISTINCT FROM new_val;
    IF changed_data IS NULL OR changed_data = '{}'::jsonb THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'DELETE';
    changed_data := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (
    table_name, record_id, action, changed_fields, user_id, timestamp
  ) VALUES (
    TG_TABLE_NAME, record_id_value, action_type, changed_data, auth.uid(), NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_permission_change();

DROP TRIGGER IF EXISTS trg_audit_user_permission_overrides ON public.user_permission_overrides;
CREATE TRIGGER trg_audit_user_permission_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_permission_change();

INSERT INTO public.schema_version (version) VALUES (169) ON CONFLICT DO NOTHING;
