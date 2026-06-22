-- Migration 205: Global manager switch for documentation celebrations
--
-- Enabled by default so the existing celebration remains unchanged after the
-- migration. The singleton office_settings row is readable by authenticated
-- users and writable only by admins under the existing RLS policies.

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS documentation_celebrations_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.office_settings.documentation_celebrations_enabled IS
  'Global manager-controlled switch for stamps, confetti and milestone effects after case documentation posts.';

INSERT INTO public.schema_version (version) VALUES (205) ON CONFLICT DO NOTHING;
