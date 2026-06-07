-- =============================================================================
-- Migration 143: schema-version sentinel — block deploys against a lagging DB
-- =============================================================================
-- PROBLEM (RELEASE_REVIEW P0 "no migration-before-deploy gate"): production is a
-- Vultr Docker host where migrations are applied BY HAND in the Supabase SQL
-- Editor and the app is deployed with SKIP_MIGRATIONS=1 (docs/DEPLOYING.md).
-- NOTHING verifies the DB schema actually matches the code before the swap, so a
-- forgotten migration ships code that 500s at runtime on a missing column/RPC.
--
-- FIX: a single source of truth for "which migration version is applied", that
-- /api/health compares against the version the BUILD expects (the highest file
-- under supabase/migrations/, computed in next.config.ts). When applied < expected
-- the health check fails (503); deploy.sh smoke-tests /api/health BEFORE the swap,
-- so a lagging schema now ABORTS the deploy instead of going live broken.
--
-- supabase_migrations.schema_migrations is NOT usable here — SQL-Editor runs do
-- not populate it (docs/DEPLOYING.md). So we keep our own tiny table that every
-- migration stamps with its own number. The sentinel reads MAX(version): the
-- documented workflow applies migrations in filename order, so MAX is a faithful
-- "how far has this DB been migrated" proxy.
--
-- CONVENTION (REQUIRED for every future migration): end the file with
--   INSERT INTO public.schema_version (version) VALUES (<N>) ON CONFLICT DO NOTHING;
-- where <N> is the migration's numeric prefix. Forgetting it leaves MAX behind →
-- the next deploy fails its own health gate (fail-safe: blocks, never ships broken).
--
-- Idempotent. Dependencies: none (self-contained).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schema_version IS
  'One row per applied migration (numeric prefix). /api/health compares MAX(version) to the version the build expects and fails readiness when the DB lags. Every migration must self-register — see migration 143. History before 143 is not individually recorded; only MAX matters for the gate.';

-- Locked down: only the service-role health check reads it (via the SECURITY
-- DEFINER function below). RLS on with NO policy = no PostgREST/anon/authenticated
-- access; service_role bypasses RLS, and SECURITY DEFINER runs as owner.
ALTER TABLE public.schema_version ENABLE ROW LEVEL SECURITY;

-- Highest migration version applied to this database (0 when the table is empty).
CREATE OR REPLACE FUNCTION public.applied_schema_version()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(version), 0) FROM public.schema_version;
$$;

REVOKE ALL ON FUNCTION public.applied_schema_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applied_schema_version() TO service_role;

-- This migration is itself version 143 (the convention, applied to itself).
INSERT INTO public.schema_version (version) VALUES (143) ON CONFLICT DO NOTHING;
