import { describe, expect, it } from 'vitest';

import { buildMailLink, buildTelLink, buildWhatsAppLink } from './contact-links';

describe('buildWhatsAppLink', () => {
  it('converts a local 10-digit mobile to wa.me 972-prefixed', () => {
    expect(buildWhatsAppLink('0501234567')).toBe('https://wa.me/972501234567');
  });

  it('strips spaces and dashes before normalizing', () => {
    expect(buildWhatsAppLink('050-123-4567')).toBe('https://wa.me/972501234567');
    expect(buildWhatsAppLink('050 123 4567')).toBe('https://wa.me/972501234567');
  });

  it('accepts +972 international form', () => {
    expect(buildWhatsAppLink('+972 50 1234567')).toBe('https://wa.me/972501234567');
  });

  it('returns null for empty / null / undefined', () => {
    expect(buildWhatsAppLink('')).toBeNull();
    expect(buildWhatsAppLink(null)).toBeNull();
    expect(buildWhatsAppLink(undefined)).toBeNull();
  });

  it('returns null for an invalid number (too short)', () => {
    expect(buildWhatsAppLink('12345')).toBeNull();
  });
});

describe('buildTelLink', () => {
  it('builds a tel: URI from a local mobile', () => {
    expect(buildTelLink('0501234567')).toBe('tel:0501234567');
  });

  it('normalizes +972 international to local 0-prefixed', () => {
    expect(buildTelLink('+972501234567')).toBe('tel:0501234567');
  });

  it('returns null for empty / null / undefined', () => {
    expect(buildTelLink('')).toBeNull();
    expect(buildTelLink(null)).toBeNull();
    expect(buildTelLink(undefined)).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(buildTelLink('not-a-phone')).toBeNull();
  });
});

describe('buildMailLink', () => {
  it('builds a mailto: URI from a trimmed address', () => {
    expect(buildMailLink('user@example.com')).toBe('mailto:user@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(buildMailLink('  user@example.com  ')).toBe('mailto:user@example.com');
  });

  it('returns null for empty / null / undefined', () => {
    expect(buildMailLink('')).toBeNull();
    expect(buildMailLink(null)).toBeNull();
    expect(buildMailLink(undefined)).toBeNull();
  });

  it('returns null when input is only whitespace', () => {
    expect(buildMailLink('   ')).toBeNull();
  });

  it('does NOT validate email shape (UI does that) — passes through garbage', () => {
    // Documents the deliberate choice: format validation is upstream (Zod
    // schema on the borrower form). The link builder just trims + wraps.
    expect(buildMailLink('not-an-email')).toBe('mailto:not-an-email');
  });
});
