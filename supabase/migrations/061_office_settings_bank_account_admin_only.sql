-- =============================================================================
-- Migration 061: Restrict office_settings.bank_account_number to admin reads
-- =============================================================================
-- office_settings has a permissive SELECT policy (everyone authenticated can
-- read the row — fair: it's office name, phone, address, etc., all needed by
-- non-admin UI like the PDF header and the topbar). But the row also carries
-- `bank_account_number`, which is sensitive and currently has no DB-layer
-- gate beyond the table-level SELECT.
--
-- Column-level GRANT works BEFORE RLS — revoking SELECT on this one column
-- from `authenticated` makes it unqueryable via PostgREST even when the
-- table-level policy allows the row. service_role + postgres bypass this
-- (used by backup-snapshot and any admin-only path that needs the value).
--
-- Existing code is unaffected — `bank_account_number` isn't read anywhere in
-- the UI/service layer today. Backup ships it via service_role + already
-- redacts it (batch 16, REDACTED_COLUMNS). This migration closes the
-- "authenticated user queries office_settings directly via REST" vector.
-- =============================================================================

REVOKE SELECT (bank_account_number) ON public.office_settings FROM authenticated;
REVOKE SELECT (bank_account_number) ON public.office_settings FROM anon;

-- Also revoke UPDATE on this column from authenticated — the office_settings
-- UPDATE policy already gates on is_admin(), but column-level GRANT removal
-- here is belt-and-suspenders: even if a future RLS regression loosens the
-- UPDATE policy, this column stays admin-only.
REVOKE UPDATE (bank_account_number) ON public.office_settings FROM authenticated;

-- Keep service_role and postgres able to read/write (default — these roles
-- aren't affected by REVOKE on authenticated/anon).
