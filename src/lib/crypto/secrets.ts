import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Symmetric encryption for secrets stored at rest (currently the office
 * OAuth tokens in office_integrations). AES-256-GCM gives confidentiality +
 * tamper detection. Values are stored as `enc:v1:<base64(iv | tag | cipher)>`.
 *
 * Pure (the key is passed in) so it's unit-testable without env wiring.
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

// Derive a fixed 32-byte AES key from an arbitrary-length secret.
function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'kfg-integration-secrets-v1', 32);
}

/** Encrypt a string → `enc:v1:<base64>`. */
export function encryptWithKey(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Options for decryptWithKey. */
export type DecryptOptions = {
  /**
   * When true, values WITHOUT the `enc:v1:` prefix throw instead of being
   * returned unchanged. Callers should enable this once they've confirmed
   * all stored values have been re-encrypted (e.g., after one full backup
   * cycle), so a regression that lands plaintext fails loudly. Defaults to
   * false (backward-compatible / legacy plaintext passthrough).
   */
  strict?: boolean;
};

/**
 * Decrypt a value produced by encryptWithKey. Values WITHOUT the enc: prefix
 * are returned unchanged when strict=false (the default) — this is the
 * backward-compat path for tokens stored before encryption was enabled. In
 * strict mode plaintext values throw, so any code path that bypasses
 * encryptWithKey fails loudly. Throws if an encrypted value was tampered
 * with or the key is wrong (GCM auth-tag check fails).
 */
export function decryptWithKey(
  value: string,
  secret: string,
  opts: DecryptOptions = {},
): string {
  if (!value.startsWith(PREFIX)) {
    if (opts.strict) {
      throw new Error('decryptWithKey: refusing plaintext value (strict mode)');
    }
    return value;
  }
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
