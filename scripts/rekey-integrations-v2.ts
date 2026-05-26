/**
 * One-shot rekey: re-encrypt every `office_integrations` row from v1 → v2.
 *
 * Run with:
 *   npx tsx scripts/rekey-integrations-v2.ts
 *
 * Requires INTEGRATION_ENCRYPTION_KEY + INTEGRATION_ENCRYPTION_SALT_V2
 * to be set in the environment (same as production). Reads tokens via
 * the service-role client, decrypts with the v1 salt (baked into
 * lib/crypto/secrets.ts), re-encrypts with the v2 salt, and writes back.
 *
 * Idempotent:
 *   - Rows already at v2 (prefix `enc:v2:`) are skipped.
 *   - Legacy plaintext rows (no prefix) skipped too — the cron + UI
 *     refresh paths will encrypt them on the next token refresh, which
 *     happens within an hour for any active integration.
 *   - Re-running after a partial run picks up where the previous one left off.
 *
 * Safe to run with the app live: each row is updated independently, and
 * the new ciphertext is byte-distinct so a partial write can't end up
 * decrypting to the wrong plaintext.
 */
import { createClient } from '@supabase/supabase-js';

import { decryptWithKey, encryptWithKeyV2 } from '@/lib/crypto/secrets';
import { env } from '@/lib/env';

import type { Database } from '@/types/database';

const V1_PREFIX = 'enc:v1:';
const V2_PREFIX = 'enc:v2:';

type TokenColumn = 'access_token' | 'refresh_token';
const TOKEN_COLUMNS: ReadonlyArray<TokenColumn> = ['access_token', 'refresh_token'];

function shouldRekey(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(V1_PREFIX);
}

async function main(): Promise<void> {
  if (!env.INTEGRATION_ENCRYPTION_SALT_V2) {
    console.error('INTEGRATION_ENCRYPTION_SALT_V2 is not set — refusing to run');
    process.exit(1);
  }

  const admin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: rows, error } = await admin
    .from('office_integrations')
    .select('provider, access_token, refresh_token');

  if (error) {
    console.error('failed to read office_integrations', error);
    process.exit(1);
  }

  let scanned = 0;
  let rekeyed = 0;
  let alreadyV2 = 0;
  let plaintext = 0;
  let failures = 0;

  for (const row of rows ?? []) {
    scanned += 1;
    const updates: Partial<Record<TokenColumn, string>> = {};
    let needsUpdate = false;

    for (const col of TOKEN_COLUMNS) {
      const value = row[col] as string | null;
      if (!value) continue;
      if (value.startsWith(V2_PREFIX)) {
        alreadyV2 += 1;
        continue;
      }
      if (!shouldRekey(value)) {
        plaintext += 1;
        continue;
      }
      try {
        const plain = decryptWithKey(value, env.INTEGRATION_ENCRYPTION_KEY);
        const reencrypted = encryptWithKeyV2(
          plain,
          env.INTEGRATION_ENCRYPTION_KEY,
          env.INTEGRATION_ENCRYPTION_SALT_V2,
        );
        updates[col] = reencrypted;
        needsUpdate = true;
      } catch (err) {
        failures += 1;
        console.error(`[${row.provider}] failed to rekey ${col}`, err);
      }
    }

    if (needsUpdate) {
      const { error: updateErr } = await admin
        .from('office_integrations')
        .update(updates)
        .eq('provider', row.provider);
      if (updateErr) {
        failures += 1;
        console.error(`[${row.provider}] failed to write rekey`, updateErr);
      } else {
        rekeyed += 1;
      }
    }
  }

  console.log('---');
  console.log(`Scanned rows:     ${scanned}`);
  console.log(`Rekeyed to v2:    ${rekeyed}`);
  console.log(`Already at v2:    ${alreadyV2}`);
  console.log(`Plaintext skipped: ${plaintext}`);
  console.log(`Failures:         ${failures}`);

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('rekey script failed', err);
  process.exit(1);
});
