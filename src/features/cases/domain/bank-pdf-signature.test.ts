import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BANK_PDF_SIGNATURE_MODE,
  isBankPdfSignatureMode,
  resolveBankPdfSignature,
} from './bank-pdf-signature';

const advisor = { name: 'יעקב שפיצר', phone: '050-1234567', email: 'yaakov@example.com' };
const office = { name: 'Kaufman Finance Group', phone: '03-1234567', email: 'office@example.com' };

describe('resolveBankPdfSignature', () => {
  it('signs with the office by default, keeping the advisor off the document', () => {
    const s = resolveBankPdfSignature('office', advisor, office);
    expect(s.name).toBe('Kaufman Finance Group');
    expect(s.contact).toBe('03-1234567 · office@example.com');
    expect(s.showAdvisorOnCover).toBe(false);
  });

  it('signs with the assigned advisor when the office opts in', () => {
    const s = resolveBankPdfSignature('advisor', advisor, office);
    expect(s.name).toBe('יעקב שפיצר');
    expect(s.contact).toBe('050-1234567 · yaakov@example.com');
    expect(s.showAdvisorOnCover).toBe(true);
  });

  it('prints nothing — not even on the cover — in "none" mode', () => {
    const s = resolveBankPdfSignature('none', advisor, office);
    expect(s.name).toBeNull();
    expect(s.contact).toBeNull();
    expect(s.showAdvisorOnCover).toBe(false);
  });

  it('omits the contact row when the party has no phone and no email', () => {
    const s = resolveBankPdfSignature('office', advisor, { name: 'משרד', phone: null, email: '  ' });
    expect(s.name).toBe('משרד');
    expect(s.contact).toBeNull();
  });

  it('joins whichever contact detail exists', () => {
    const s = resolveBankPdfSignature('advisor', { ...advisor, email: null }, office);
    expect(s.contact).toBe('050-1234567');
  });

  it('guards unknown stored values', () => {
    expect(isBankPdfSignatureMode('office')).toBe(true);
    expect(isBankPdfSignatureMode('manager')).toBe(false);
    expect(isBankPdfSignatureMode(null)).toBe(false);
    expect(DEFAULT_BANK_PDF_SIGNATURE_MODE).toBe('office');
  });
});
