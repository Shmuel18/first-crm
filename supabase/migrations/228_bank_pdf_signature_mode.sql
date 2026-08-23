-- =============================================================================
-- Migration 228: office_settings.bank_pdf_signature_mode
-- =============================================================================
-- The bank summary PDF signed itself with the case's ASSIGNED ADVISOR — name,
-- personal phone and personal email — with no way to change it. Kaufman asked
-- for either nothing at all or an office-level setting.
--
-- The bank relationship belongs to the office, not to the individual advisor:
--   - an advisor's personal contact details should not reach the bank on every
--     submission,
--   - when an advisor leaves, every historical PDF still carries their name.
-- ...but a submission with NO contact block leaves the bank clerk with nobody
-- to call back, so "nothing" is an option rather than the rule.
--
-- Three modes, office-wide (admin-set in Settings → Office):
--   'office'  → office name + office phone/email (DEFAULT — see below)
--   'advisor' → the case's assigned advisor (the previous, hardcoded behaviour)
--   'none'    → a blank signature line, no name, no contact details
--
-- WHY 'office' IS THE DEFAULT: it is the behaviour the office asked for, and a
-- silent switch to 'advisor' would keep leaking personal details for anyone who
-- never opens the setting. The signature reader falls back to 'office' too, so
-- code deployed against a lagging DB behaves the same (the schema-version gate
-- in /api/health makes that window theoretical, migration 143).
--
-- The 'office' contact values reuse office_settings.office_name / phone_main /
-- email_main — no new columns, and they are already maintained in the same UI.
--
-- Dependencies: 010 (office_settings), 143 (schema_version). No RLS change:
-- office_settings policies already gate writes to admins.
-- =============================================================================

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS bank_pdf_signature_mode TEXT NOT NULL DEFAULT 'office'
    CHECK (bank_pdf_signature_mode IN ('office', 'advisor', 'none'));

COMMENT ON COLUMN public.office_settings.bank_pdf_signature_mode IS
  'Who signs the bank summary PDF: office (name + main phone/email), advisor (case assignee), or none (blank line).';

INSERT INTO public.schema_version (version) VALUES (228) ON CONFLICT DO NOTHING;
