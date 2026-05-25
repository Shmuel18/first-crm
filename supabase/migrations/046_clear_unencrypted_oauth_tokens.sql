-- =============================================================================
-- Migration 046: Clear unencrypted OAuth tokens from office_integrations
-- =============================================================================
-- Closes the P0 from the pre-prod audit: INTEGRATION_ENCRYPTION_KEY was
-- declared `.optional()` in env.ts, and integrations.service.ts silently fell
-- through to plaintext storage when the key was unset. Any tokens written
-- before the key got wired up are still sitting in the DB as raw strings.
--
-- env.ts now requires the key (next deploy fails build without it). On the
-- next refresh/upsert, encryptToken will re-encrypt automatically — but a
-- token that's about to expire (or that never gets refreshed because the
-- session is idle) would linger as plaintext for days.
--
-- Cheapest correct path: clear the row, flip status to 'disconnected', and
-- let the admin reconnect. Re-auth is a 30-second click for a real admin and
-- guarantees the new row goes through the encrypted path.
--
-- Idempotent: the WHERE filters out rows that are already encrypted (enc:v1:
-- prefix), so re-running this migration is a no-op.
-- =============================================================================

UPDATE public.office_integrations
SET
  status = 'disconnected',
  access_token = NULL,
  refresh_token = NULL,
  token_expires_at = NULL,
  last_error = 'cleared by migration 046: re-encryption required'
WHERE
  (access_token IS NOT NULL AND access_token NOT LIKE 'enc:v1:%')
  OR (refresh_token IS NOT NULL AND refresh_token NOT LIKE 'enc:v1:%');
