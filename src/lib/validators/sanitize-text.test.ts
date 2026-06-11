import { describe, expect, it } from 'vitest';

import { optionalEmail, optionalNotes, optionalShortString, requiredEmail } from './form-primitives';
import { sanitizeMultiLine, sanitizeSingleLine, stripInvisible } from './sanitize-text';

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

describe('sanitizeSingleLine', () => {
  it('collapses CR/LF and control chars to a single space', () => {
    expect(sanitizeSingleLine('Foo\r\nBar: x')).toBe('Foo Bar: x');
    expect(sanitizeSingleLine('a\tb')).toBe('a b');
    // NUL + BEL run collapses to a single space (built from code points so
    // the test source stays pure ASCII, matching the file convention).
    expect(sanitizeSingleLine(`a${String.fromCharCode(0)}${String.fromCharCode(7)}b`)).toBe('a b');
  });

  it('strips invisible bidi chars and trims', () => {
    expect(sanitizeSingleLine(`  a${ZWSP}b  `)).toBe('ab');
    const RLO = String.fromCharCode(0x202e);
    expect(sanitizeSingleLine(`${RLO}name`)).toBe('name');
  });
});

describe('sanitizeMultiLine', () => {
  it('preserves line breaks and tabs but strips other control chars', () => {
    // BEL stripped, newline kept.
    expect(sanitizeMultiLine(`x${String.fromCharCode(7)}y${String.fromCharCode(10)}z`)).toBe(
      `xy${String.fromCharCode(10)}z`,
    );
    expect(sanitizeMultiLine('line1\nline2\tend')).toBe('line1\nline2\tend');
    expect(sanitizeMultiLine('ab\nc')).toBe('ab\nc');
  });

  it('strips invisible bidi chars and trims outer whitespace', () => {
    expect(sanitizeMultiLine(` a${BOM}b \n`)).toBe('ab');
  });
});

describe('optional string primitives normalize like required ones', () => {
  it('optionalShortString strips invisible chars and trims', () => {
    const res = optionalShortString().safeParse(`a${ZWSP}b `);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBe('ab');
  });

  it('optionalShortString maps whitespace-only input to null', () => {
    const res = optionalShortString().safeParse('   ');
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBeNull();
  });

  it('optionalNotes keeps newlines but strips bidi/control chars', () => {
    const res = optionalNotes().safeParse(`first${RLM}\nsecond`);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBe('first\nsecond');
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
