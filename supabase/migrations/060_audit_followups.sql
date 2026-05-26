-- =============================================================================
-- Migration 060: Follow-up audit-driven hardening (P1/P2 items)
-- =============================================================================
-- Bundles the smaller hardening items from the post-pre-prod-audit second
-- pass: a few RLS/trigger tightenings, missing DEFAULTs, duplicate index
-- cleanup, and uniqueness gaps on tables that were flagged but weren't part
-- of the first migration batch (049-059).
--
-- PRE-DEPLOY CHECKS (run via SQL editor; clean up if rows return):
--
--   -- Duplicate profile emails differing only in case:
--   SELECT lower(email), array_agg(email), array_agg(id)
--     FROM public.profiles
--    WHERE email IS NOT NULL
--    GROUP BY lower(email)
--   HAVING COUNT(*) > 1;
--
--   -- Duplicate live leads on national_id:
--   SELECT national_id, COUNT(*)
--     FROM public.leads
--    WHERE national_id IS NOT NULL AND deleted_at IS NULL AND status != 'converted'
--    GROUP BY national_id
--   HAVING COUNT(*) > 1;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles.metadata is locked against self-update
-- -----------------------------------------------------------------------------
-- profiles_update_self lets a user UPDATE their own row but doesn't restrict
-- which columns. metadata is a free-form JSONB; a future
-- `profiles.metadata.bypass_2fa = true` (or similar mis-named key) would be
-- an instant escalation if code anywhere reads `metadata.*` and trusts it.
-- Guard: any UPDATE that changes metadata must come from an admin OR a
-- SECURITY DEFINER path that explicitly opts in via a session GUC.
CREATE OR REPLACE FUNCTION public.profiles_guard_self_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_bypass TEXT;
BEGIN
  -- Admin path always allowed (settings page edits metadata via this).
  v_is_admin := COALESCE(public.is_admin(), FALSE);
  IF v_is_admin THEN RETURN NEW; END IF;

  -- Opt-in escape hatch for SECURITY DEFINER RPCs that legitimately need
  -- to set metadata (e.g. dashboard_config). Set via SET LOCAL inside the
  -- function; expires at txn end.
  v_bypass := current_setting('app.allow_profile_metadata_update', true);
  IF v_bypass = 'on' THEN RETURN NEW; END IF;

  -- For everyone else, reject metadata changes outright.
  RAISE EXCEPTION 'profiles.metadata changes require admin'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_self_metadata ON public.profiles;
CREATE TRIGGER trg_profiles_guard_self_metadata
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.metadata IS DISTINCT FROM OLD.metadata)
  EXECUTE FUNCTION public.profiles_guard_self_metadata();

-- -----------------------------------------------------------------------------
-- 2. documents.uploaded_by gets a sensible DEFAULT
-- -----------------------------------------------------------------------------
-- Today the column is nullable + no DEFAULT. The action layer sets it
-- explicitly, but a future RPC / restore path that omits it leaves NULL —
-- audit trail loses "who uploaded this". Default to auth.uid() so any new
-- INSERT picks up the caller automatically.
ALTER TABLE public.documents
  ALTER COLUMN uploaded_by SET DEFAULT auth.uid();

-- -----------------------------------------------------------------------------
-- 3. notifications: explicit INSERT deny (defense-in-depth)
-- -----------------------------------------------------------------------------
-- notifications has RLS on but no INSERT policy, so authenticated INSERTs
-- are denied by default. Making the denial explicit documents intent and
-- prevents a future "add an INSERT policy" PR from quietly granting writes
-- when only the SECURITY DEFINER trigger should write.
CREATE POLICY "notifications_no_direct_insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

-- -----------------------------------------------------------------------------
-- 4. tasks.tags gets a GIN index
-- -----------------------------------------------------------------------------
-- Migration 034 added tags TEXT[]. Tag-based filters (server-side in the
-- next refactor; client-side today) currently full-scan. GIN keeps that
-- option open without committing the app yet.
CREATE INDEX IF NOT EXISTS idx_tasks_tags
  ON public.tasks USING GIN (tags)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Drop duplicate partial indexes covered by the UNIQUE constraints
-- -----------------------------------------------------------------------------
-- Migration 024 added partial UNIQUE indexes for "one primary per case" on
-- both case_banks and case_borrowers. Migrations 006/007 had created
-- non-unique partial indexes with the same predicates. The UNIQUE indexes
-- serve point lookups equally well, so the non-unique copies are dead
-- weight (just extra write cost on every INSERT/UPDATE).
DROP INDEX IF EXISTS public.idx_case_banks_primary;
DROP INDEX IF EXISTS public.idx_case_borrowers_primary;

-- -----------------------------------------------------------------------------
-- 6. profiles.email case-insensitive uniqueness + format CHECK
-- -----------------------------------------------------------------------------
-- auth.users.email is citext UNIQUE, but public.profiles.email is a separate
-- copy with no normalization — two profiles can drift to differ only in
-- case. Add a case-insensitive partial UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_lower
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_format
    CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$');

-- -----------------------------------------------------------------------------
-- 7. leads.national_id partial UNIQUE
-- -----------------------------------------------------------------------------
-- Same shape as the borrowers UNIQUE from migration 053: prevent two LIVE
-- non-converted leads from sharing a national_id. Doesn't touch converted
-- leads (those already became cases and their data lives on the borrower).
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_national_id_active
  ON public.leads (national_id)
  WHERE national_id IS NOT NULL
    AND deleted_at IS NULL
    AND status != 'converted';
