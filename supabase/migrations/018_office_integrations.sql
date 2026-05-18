-- =============================================================================
-- Migration 018: Office Integrations
-- =============================================================================
-- Purpose: Store OAuth tokens + metadata for third-party connections
--          (Google Drive, Google Calendar, WhatsApp Business, etc.)
--          Office-level connection: one shared account per provider per office.
-- Dependencies: 002_auth_core (profiles), 011_rls_policies (is_admin)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.office_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'google_calendar', 'whatsapp', 'resend')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error')),
  -- OAuth identity
  connected_email TEXT,
  connected_external_user_id TEXT,
  -- Tokens (stored server-side, RLS restricts to admins only)
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  -- Provider-specific
  drive_root_folder_id TEXT,
  drive_root_folder_name TEXT NOT NULL DEFAULT 'KFG_Cases',
  -- Audit
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  connected_by UUID REFERENCES public.profiles(id),
  connected_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.office_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.office_integrations(status);

CREATE TRIGGER trg_office_integrations_updated_at
  BEFORE UPDATE ON public.office_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_integrations ENABLE ROW LEVEL SECURITY;

-- RLS: admins only - tokens are sensitive
CREATE POLICY "integrations_admin_select" ON public.office_integrations
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "integrations_admin_modify" ON public.office_integrations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed: empty row for google_drive so the UI has something to read (disconnected by default)
INSERT INTO public.office_integrations (provider, status)
VALUES ('google_drive', 'disconnected')
ON CONFLICT (provider) DO NOTHING;

COMMENT ON TABLE public.office_integrations IS
  'Office-level third-party integrations. One row per provider (singleton via UNIQUE constraint). Tokens stored here; access gated by is_admin() RLS.';
