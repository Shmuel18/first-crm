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

/**
 * Decrypt a value produced by encryptWithKey. Values WITHOUT the enc: prefix
 * are returned unchanged — this is the backward-compat path for tokens stored
 * before encryption was enabled. Throws if an encrypted value was tampered
 * with or the key is wrong (GCM auth-tag check fails).
 */
export function decryptWithKey(value: string, secret: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
