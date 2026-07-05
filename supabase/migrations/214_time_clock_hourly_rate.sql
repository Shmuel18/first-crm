-- =============================================================================
-- Migration 214: profiles.hourly_rate — pay rate for the time clock
-- =============================================================================
-- The manager sets an hourly wage per tracked employee; the clock shows earnings
-- (worked hours × rate) alongside the hours — live on the employee's timer and
-- in the manager's timesheet + Excel export. NULL = no rate set (earnings hidden).
--
-- Lives on profiles (already backed up via select('*'); the restore RPC's
-- jsonb_populate_recordset auto-handles the new column — no allowlist change).
-- profiles RLS is self-or-admin, so an employee sees only their OWN rate and the
-- manager (is_admin) sees all — exactly the sensitivity we want for wage data.
-- Dependencies: 002 (profiles), 213 (time_tracked/auto_clock_in siblings).
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0);

INSERT INTO public.schema_version (version) VALUES (214) ON CONFLICT DO NOTHING;
