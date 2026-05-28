-- =============================================================================
-- Migration 091: Batch permission checks
-- =============================================================================
-- Several RSC routes need multiple app-side permission booleans for UX gates.
-- Calling has_permission() once per key is correct but expensive on self-hosted
-- deployments where every Supabase request pays a visible network round-trip.
-- This function preserves the existing precedence:
--   user override > role permission > false
-- while returning all requested keys in a single RPC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_permissions(perm_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_role_id UUID;
  v_result JSONB := '{}'::jsonb;
BEGIN
  IF perm_keys IS NULL OR array_length(perm_keys, 1) IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_actor IS NULL THEN
    SELECT COALESCE(jsonb_object_agg(k.key, FALSE), '{}'::jsonb)
      INTO v_result
      FROM (SELECT DISTINCT key FROM unnest(perm_keys) AS key WHERE key IS NOT NULL) k;
    RETURN v_result;
  END IF;

  SELECT p.role_id
    INTO v_role_id
    FROM public.profiles p
   WHERE p.id = v_actor
     AND p.is_active = TRUE;

  IF v_role_id IS NULL THEN
    SELECT COALESCE(jsonb_object_agg(k.key, FALSE), '{}'::jsonb)
      INTO v_result
      FROM (SELECT DISTINCT key FROM unnest(perm_keys) AS key WHERE key IS NOT NULL) k;
    RETURN v_result;
  END IF;

  WITH requested AS (
    SELECT DISTINCT key
      FROM unnest(perm_keys) AS key
     WHERE key IS NOT NULL
  ),
  overrides AS (
    SELECT p.key, uo.is_granted
      FROM public.user_permission_overrides uo
      JOIN public.permissions p ON p.id = uo.permission_id
      JOIN requested r ON r.key = p.key
     WHERE uo.user_id = v_actor
  ),
  role_grants AS (
    SELECT p.key, BOOL_OR(rp.is_granted = TRUE) AS is_granted
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      JOIN requested r ON r.key = p.key
     WHERE rp.role_id = v_role_id
     GROUP BY p.key
  )
  SELECT COALESCE(
    jsonb_object_agg(
      r.key,
      COALESCE(o.is_granted, rg.is_granted, FALSE)
    ),
    '{}'::jsonb
  )
    INTO v_result
    FROM requested r
    LEFT JOIN overrides o ON o.key = r.key
    LEFT JOIN role_grants rg ON rg.key = r.key;

  RETURN v_result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.has_permissions(TEXT[]) TO authenticated;
