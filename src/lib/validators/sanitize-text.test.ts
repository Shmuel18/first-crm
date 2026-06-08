import { describe, expect, it } from 'vitest';

import { optionalEmail, requiredEmail } from './form-primitives';
import { stripInvisible } from './sanitize-text';

// Built from code points so this test source stays pure ASCII (no invisible
// characters embedded in string literals).
const RLM = String.fromCharCode(0x200f); // right-to-left mark
const LRM = String.fromCharCode(0x200e); // left-to-right mark
const ZWSP = String.fromCharCode(0x200b); // zero-width space
const BOM = String.fromCharCode(0xfeff); // zero-width no-break space / BOM

describe('stripInvisible', () => {
  it('removes directional marks (LRM/RLM) anywhere in the string', () => {
    expect(stripInvisible(`${LRM}udi.gerlitz@gmail.com`)).toBe('udi.gerlitz@gmail.com');
    expect(stripInvisible(`udi.gerlitz@gmail.com${RLM}`)).toBe('udi.gerlitz@gmail.com');
    expect(stripInvisible(`udi.gerlitz@gmail${RLM}.com`)).toBe('udi.gerlitz@gmail.com');
  });

  it('removes zero-width space and BOM', () => {
    expect(stripInvisible(`a${ZWSP}b${BOM}`)).toBe('ab');
  });

  it('leaves ordinary Latin and Hebrew text untouched', () => {
    expect(stripInvisible('udi.gerlitz@gmail.com')).toBe('udi.gerlitz@gmail.com');
    expect(stripInvisible('משה קופמן')).toBe('משה קופמן');
  });
});

describe('email primitives tolerate hidden RTL characters', () => {
  it('optionalEmail accepts an address carrying an invisible RLM mark', () => {
    const res = optionalEmail.safeParse(`udi.gerlitz@gmail.com${RLM}`);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBe('udi.gerlitz@gmail.com');
  });

  it('requiredEmail accepts a leading LRM + uppercase, normalizing both', () => {
    const res = requiredEmail.safeParse(`${LRM}Udi.Gerlitz@Gmail.com`);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBe('udi.gerlitz@gmail.com');
  });

  it('still rejects a genuinely malformed address', () => {
    expect(optionalEmail.safeParse('not-an-email').success).toBe(false);
  });
});
