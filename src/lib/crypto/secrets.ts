import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Symmetric encryption for secrets stored at rest.
 *
 * Currently used for:
 *   - office_integrations.access_token / refresh_token (Google OAuth)
 *   - backup snapshot JSON before Drive upload
 *
 * Algorithm: AES-256-GCM (confidentiality + tamper detection).
 *
 * Versioned prefix:
 *   - `enc:v1:` — fixed salt baked into the code ('kfg-integration-secrets-v1').
 *     The original scheme. Cryptographically sound but means every deployment
 *     of the same code base shares the salt — a leak of the source plus a
 *     ciphertext blob lets you derive the working key.
 *   - `enc:v2:` — per-deployment salt sourced from the SECOND argument to
 *     encryptWithKey (the caller passes a salt distinct from the secret).
 *     Wiring env vars (INTEGRATION_ENCRYPTION_SALT_V2 / BACKUP_ENCRYPTION_SALT_V2)
 *     means two deployments with the same code can't derive each other's keys.
 *
 * Decrypt is backward-compatible: prefix-detection routes to the right
 * scheme. Strict-mode toggles refuse plaintext OR refuse v1 (post-rekey).
 *
 * Pure (the key + salt are passed in) so it's unit-testable without env wiring.
 */

const ALGO = 'aes-256-gcm';
const PREFIX_V1 = 'enc:v1:';
const PREFIX_V2 = 'enc:v2:';
const V1_SALT = 'kfg-integration-secrets-v1';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(secret: string, salt: string): Buffer {
  return scryptSync(secret, salt, KEY_LEN);
}

/**
 * Encrypt a string using the v1 scheme (fixed code-baked salt). Kept for
 * the (now narrow) cases where no v2 salt has been wired yet — e.g.,
 * during the gap between deploying the v2 code and adding the env var.
 *
 * New code should prefer `encryptWithKeyV2` whenever a salt is available;
 * the rekey migration (067) flips all stored values to v2.
 */
export function encryptWithKey(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(secret, V1_SALT), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX_V1 + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Encrypt a string using the v2 scheme (per-deployment salt). The salt
 * MUST be a value distinct from the encryption secret — a random
 * 32+-byte string from `openssl rand -base64 48` is the right size.
 *
 * The salt is NOT stored in the ciphertext envelope; the decrypt path
 * has to know the same salt out-of-band (read from env).
 */
export function encryptWithKeyV2(plaintext: string, secret: string, salt: string): string {
  if (!salt || salt.length < 16) {
    throw new Error('encryptWithKeyV2: salt must be at least 16 chars');
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(secret, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX_V2 + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Options for decryptWithKey. */
export type DecryptOptions = {
  /**
   * When true, values WITHOUT any `enc:` prefix throw instead of being
   * returned unchanged. Callers should enable this once they've confirmed
   * all stored values have been re-encrypted (e.g., after one full backup
   * cycle), so a regression that lands plaintext fails loudly. Defaults to
   * false (backward-compatible / legacy plaintext passthrough).
   */
  strict?: boolean;
  /**
   * When true, values with the `enc:v1:` prefix throw — useful after the
   * v2 rekey migration is complete and we want any straggler v1 row to
   * surface loudly rather than silently re-decrypting. Defaults to false.
   * (`requireV2` implies `strict` — plaintext is always rejected when set.)
   */
  requireV2?: boolean;
  /**
   * Per-deployment salt for the v2 scheme. REQUIRED if any value passed to
   * this function might have a `enc:v2:` prefix. When unset, v2 values
   * fall back to throwing instead of silently decrypting under the wrong
   * key (which would just produce a GCM auth-tag failure deeper in the
   * stack — better to fail clearly here).
   */
  saltV2?: string;
};

/**
 * Decrypt a value produced by encryptWithKey / encryptWithKeyV2.
 *
 * Routing:
 *   - `enc:v2:` prefix → derive key from `opts.saltV2`. Throws if salt missing.
 *   - `enc:v1:` prefix → derive key from V1_SALT (code-baked).
 *   - No prefix → return unchanged unless `opts.strict` is true.
 *
 * Throws if a ciphertext was tampered with or the key/salt is wrong (GCM
 * auth-tag check fails).
 */
export function decryptWithKey(
  value: string,
  secret: string,
  opts: DecryptOptions = {},
): string {
  if (value.startsWith(PREFIX_V2)) {
    if (!opts.saltV2) {
      throw new Error('decryptWithKey: enc:v2: value but no saltV2 provided');
    }
    return unwrap(value.slice(PREFIX_V2.length), secret, opts.saltV2);
  }
  if (value.startsWith(PREFIX_V1)) {
    if (opts.requireV2) {
      throw new Error('decryptWithKey: refusing enc:v1: value (requireV2)');
    }
    return unwrap(value.slice(PREFIX_V1.length), secret, V1_SALT);
  }
  // No prefix → legacy plaintext.
  if (opts.strict || opts.requireV2) {
    throw new Error('decryptWithKey: refusing plaintext value (strict mode)');
  }
  return value;
}

function unwrap(b64: string, secret: string, salt: string): string {
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, deriveKey(secret, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
