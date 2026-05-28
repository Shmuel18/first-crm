import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const isProductionRuntime = process.env.NODE_ENV === 'production';
const serverActionsEncryptionKeySchema = isProductionRuntime
  ? z.string().min(24, 'Missing NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')
  : z.string().min(24).optional();

/**
 * Type-safe environment variables.
 * Throws at build time if any required variable is missing.
 */
export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Missing SUPABASE_SERVICE_ROLE_KEY'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Google OAuth - OPTIONAL. When unset, the Drive integration UI shows
    // "not configured" instead of a working Connect button.
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
    GOOGLE_OAUTH_ALLOWED_DOMAIN: z.string().optional(),
    // Email (Resend) - OPTIONAL. When unset, email sending is skipped and
    // dependent flows (task emails, team invite emails) fall back gracefully.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    // Secret for the nightly backup cron. OPTIONAL: when unset, the cron route
    // rejects every call, so the endpoint can't be triggered by anyone. When
    // set, require ≥32 chars so a stub value (`CRON_SECRET=test`) can't make
    // the endpoint reachable with a trivially-brute-forceable token. Generate
    // with `openssl rand -base64 48`.
    CRON_SECRET: z.string().min(32).optional(),
    // Key for encrypting office_integrations OAuth tokens at rest (AES-256-GCM).
    // REQUIRED — without it, refresh tokens would land in Postgres in plaintext
    // and any DB dump / read leaks them. decryptWithKey is backward-compatible
    // with legacy plaintext rows (returns them unchanged), so enabling this on
    // an existing deploy is non-breaking: tokens re-encrypt on next refresh.
    // Generate with: `openssl rand -base64 48` (>=32 chars).
    INTEGRATION_ENCRYPTION_KEY: z.string().min(32),
    // Key for encrypting the whole backup JSON before it's uploaded to Drive.
    // REQUIRED — the snapshot includes PII (borrower names/phones/emails) and
    // manager-only fields (case_financials.fee_amount, expected_income). Anyone
    // with access to the Drive folder would otherwise read them in cleartext.
    // KEEP THIS KEY SAFE: lose it = backup files are unrecoverable. Generate
    // with: `openssl rand -base64 48` (>=32 chars). Use a DIFFERENT value than
    // INTEGRATION_ENCRYPTION_KEY so a leak of one doesn't expose the other.
    BACKUP_ENCRYPTION_KEY: z.string().min(32),
    // Strict-mode toggles for the encryption layer. Default false for backward
    // compatibility with legacy plaintext rows / backups. Once you've confirmed
    // every stored value has been re-encrypted (e.g. all OAuth tokens cleared
    // by migration 046; at least one new backup written after enabling
    // BACKUP_ENCRYPTION_KEY), flip these to "true" so any future code path
    // that bypasses encryption fails loudly instead of silently accepting
    // plaintext.
    BACKUP_ENCRYPTION_STRICT: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    INTEGRATION_ENCRYPTION_STRICT: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    // Per-deployment salts for the v2 encryption layer. OPTIONAL — when
    // unset, the decrypt path still handles `enc:v1:` rows (fixed-salt,
    // baked into the code) but new encryptions degrade-write as v1 too.
    // Once you've set these in Vercel + .env.local and run the rekey
    // migration (067), strict mode below can be enabled to refuse v1
    // entirely. Generate 32+ random bytes each: `openssl rand -base64 48`.
    // Use DIFFERENT values for integration + backup so a leak of one
    // doesn't compromise the other.
    INTEGRATION_ENCRYPTION_SALT_V2: z.string().min(32).optional(),
    BACKUP_ENCRYPTION_SALT_V2: z.string().min(32).optional(),
    // Sentry DSN. OPTIONAL — when unset, Sentry init is skipped entirely
    // (no SDK overhead in dev / on a fresh deploy without an account).
    // Once you create a Sentry project, drop the DSN in here and the
    // instrumentation hook picks it up on the next cold start.
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    // Stable key for self-hosted Server Actions. Required in production so a
    // rebuild cannot leave open browser tabs submitting action IDs the new
    // server rejects.
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: serverActionsEncryptionKeySchema,
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    NEXT_PUBLIC_APP_NAME: z.string().default('Kaufman Finance Group'),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    // Same DSN as the server, but bundled into the client for browser-side
    // error reporting. Mirror NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN in Vercel.
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_ALLOWED_DOMAIN: process.env.GOOGLE_OAUTH_ALLOWED_DOMAIN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
    BACKUP_ENCRYPTION_STRICT: process.env.BACKUP_ENCRYPTION_STRICT,
    INTEGRATION_ENCRYPTION_STRICT: process.env.INTEGRATION_ENCRYPTION_STRICT,
    INTEGRATION_ENCRYPTION_SALT_V2: process.env.INTEGRATION_ENCRYPTION_SALT_V2,
    BACKUP_ENCRYPTION_SALT_V2: process.env.BACKUP_ENCRYPTION_SALT_V2,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: true,
});

/**
 * Returns true if the dev has wired up the Google OAuth client.
 * Without these env vars, the Drive integration UI hides the Connect button.
 */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID &&
      env.GOOGLE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

/**
 * Returns true if email sending is wired up (Resend key + a from-address).
 * When false, sendEmail() no-ops and dependent flows fall back gracefully.
 */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

// Warn at first-import in production when env vars that are declared "optional"
// but operationally critical have been left unset. Vercel surfaces this in the
// Functions logs on every cold start, which is annoying enough to fix and
// quiet enough not to spam after the fix lands. Dev / test deploys skip the
// warning so localhost stays quiet.
if (env.NODE_ENV === 'production') {
  const warnings: string[] = [];
  if (!env.CRON_SECRET) {
    warnings.push('CRON_SECRET is unset — /api/cron/backup will refuse every call (nightly backup disabled).');
  }
  if (!isEmailConfigured()) {
    warnings.push('RESEND_API_KEY / EMAIL_FROM are unset — team invites have to share the link manually instead of emailing it.');
  }
  if (!isGoogleOAuthConfigured()) {
    warnings.push('GOOGLE_OAUTH_* are unset — Drive integration (sync, backup destination, document upload mirror) is disabled.');
  }
  if (warnings.length > 0) {
    console.warn('[env] production deploy is missing optional-but-critical config:\n  - ' + warnings.join('\n  - '));
  }
}
