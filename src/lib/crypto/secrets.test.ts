import { describe, expect, it } from 'vitest';

import { decryptWithKey, encryptWithKey } from './secrets';

const KEY = 'test-integration-encryption-key-0123456789';

describe('encryptWithKey / decryptWithKey', () => {
  it('round-trips a value', () => {
    const plain = 'ya29.a0AfH6SMB-secret-refresh-token';
    const enc = encryptWithKey(plain, KEY);
    expect(enc).not.toBe(plain);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptWithKey(enc, KEY)).toBe(plain);
  });

  it('produces different ciphertext each call (random IV)', () => {
    expect(encryptWithKey('x', KEY)).not.toBe(encryptWithKey('x', KEY));
  });

  it('passes legacy plaintext (no prefix) through unchanged', () => {
    expect(decryptWithKey('legacy-plaintext-token', KEY)).toBe('legacy-plaintext-token');
  });

  it('round-trips unicode', () => {
    const v = 'סוד-עברית-🔐';
    expect(decryptWithKey(encryptWithKey(v, KEY), KEY)).toBe(v);
  });

  it('throws when the ciphertext is tampered with', () => {
    const enc = encryptWithKey('secret value', KEY);
    const body = enc.slice('enc:v1:'.length);
    const flipped = body[5] === 'A' ? 'B' : 'A';
    const tampered = `enc:v1:${body.slice(0, 5)}${flipped}${body.slice(6)}`;
    expect(() => decryptWithKey(tampered, KEY)).toThrow();
  });

  it('throws when decrypting with the wrong key', () => {
    const enc = encryptWithKey('secret', KEY);
    expect(() => decryptWithKey(enc, 'a-different-key-of-sufficient-length')).toThrow();
  });
});
