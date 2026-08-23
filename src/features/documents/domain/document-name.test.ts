import { describe, expect, it } from 'vitest';

import { applyDocumentName, documentDisplayName } from './document-name';

describe('applyDocumentName', () => {
  it('keeps the original extension when the advisor types a bare name', () => {
    expect(applyDocumentName('חוזה רכישה', 'ownershipConfirmation.pdf')).toBe('חוזה רכישה.pdf');
  });

  it('does not double the extension when the advisor typed one', () => {
    expect(applyDocumentName('חוזה רכישה.pdf', 'scan.pdf')).toBe('חוזה רכישה.pdf');
    expect(applyDocumentName('חוזה רכישה.PDF', 'scan.pdf')).toBe('חוזה רכישה.PDF');
  });

  it('leaves an extensionless file extensionless', () => {
    expect(applyDocumentName('חוזה רכישה', 'scan')).toBe('חוזה רכישה');
  });

  it('is not fooled by a dot inside the name', () => {
    expect(applyDocumentName('דוח 2026', 'תלוש 01.2026')).toBe('דוח 2026');
  });

  it('rejects a name that sanitizes to nothing', () => {
    expect(applyDocumentName('   ', 'scan.pdf')).toBeNull();
  });

  it('strips path separators rather than letting them through', () => {
    expect(applyDocumentName('a/b', 'scan.pdf')).toBe('a_b.pdf');
  });
});

describe('documentDisplayName', () => {
  it('hides the extension', () => {
    expect(documentDisplayName('חוזה רכישה.pdf')).toBe('חוזה רכישה');
  });

  it('returns the name unchanged when there is no extension', () => {
    expect(documentDisplayName('חוזה רכישה')).toBe('חוזה רכישה');
  });

  it('never returns an empty label for a dotfile-style name', () => {
    expect(documentDisplayName('.pdf')).toBe('.pdf');
  });
});
