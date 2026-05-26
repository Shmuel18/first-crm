import { describe, expect, it } from 'vitest';

import { decryptWithKey, encryptWithKey, encryptWithKeyV2 } from './secrets';

const KEY = 'test-integration-encryption-key-0123456789';
const SALT_V2 = 'per-deploy-salt-aaaa-bbbb-cccc-dddd-eeee';
const SALT_V2_OTHER = 'per-deploy-salt-1111-2222-3333-4444-5555';

describe('encryptWithKey / decryptWithKey (v1)', () => {
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

describe('encryptWithKeyV2 / decryptWithKey (v2)', () => {
  it('round-trips a value with the v2 prefix', () => {
    const plain = 'top-secret-value-2026';
    const enc = encryptWithKeyV2(plain, KEY, SALT_V2);
    expect(enc.startsWith('enc:v2:')).toBe(true);
    expect(decryptWithKey(enc, KEY, { saltV2: SALT_V2 })).toBe(plain);
  });

  it('rejects a short salt', () => {
    expect(() => encryptWithKeyV2('x', KEY, 'too-short')).toThrow(/salt/);
  });

  it('throws decrypting a v2 value with a different salt', () => {
    const enc = encryptWithKeyV2('secret', KEY, SALT_V2);
    expect(() => decryptWithKey(enc, KEY, { saltV2: SALT_V2_OTHER })).toThrow();
  });

  it('throws decrypting a v2 value when no saltV2 is provided', () => {
    const enc = encryptWithKeyV2('secret', KEY, SALT_V2);
    expect(() => decryptWithKey(enc, KEY)).toThrow(/saltV2/);
  });

  it('routes v1 + v2 values from the same decrypt call by prefix', () => {
    const v1 = encryptWithKey('a', KEY);
    const v2 = encryptWithKeyV2('b', KEY, SALT_V2);
    expect(decryptWithKey(v1, KEY, { saltV2: SALT_V2 })).toBe('a');
    expect(decryptWithKey(v2, KEY, { saltV2: SALT_V2 })).toBe('b');
  });

  it('strict mode rejects plaintext but accepts v1 + v2', () => {
    expect(() => decryptWithKey('plain', KEY, { strict: true })).toThrow();
    const v1 = encryptWithKey('a', KEY);
    const v2 = encryptWithKeyV2('b', KEY, SALT_V2);
    expect(decryptWithKey(v1, KEY, { strict: true })).toBe('a');
    expect(decryptWithKey(v2, KEY, { strict: true, saltV2: SALT_V2 })).toBe('b');
  });

  it('requireV2 mode rejects v1 + plaintext, accepts v2', () => {
    const v1 = encryptWithKey('a', KEY);
    const v2 = encryptWithKeyV2('b', KEY, SALT_V2);
    expect(() => decryptWithKey(v1, KEY, { requireV2: true, saltV2: SALT_V2 })).toThrow(
      /v1/,
    );
    expect(() => decryptWithKey('plain', KEY, { requireV2: true, saltV2: SALT_V2 })).toThrow();
    expect(decryptWithKey(v2, KEY, { requireV2: true, saltV2: SALT_V2 })).toBe('b');
  });
});
