import { createHash, randomBytes } from 'node:crypto';

/**
 * Single-use signing-link token: 256 bits of CSPRNG entropy, base64url so it
 * travels safely in a path segment. Unguessable by construction — the rate
 * limits on the public endpoints are belt-and-suspenders, not the defense.
 */
export function generateAgreementToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only this digest is ever persisted (case_agreements.token_hash). A leaked
 * DB row/backup cannot be replayed into a signing session; the plaintext
 * token exists solely inside the emailed link.
 */
export function hashAgreementToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
