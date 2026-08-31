import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';

import { AgreementPdfDocument, type AgreementPdfData } from './agreement-pdf-document';

/**
 * The office can now write arbitrarily long clauses in Settings, so the PDF
 * must be able to flow a section across pages. An earlier version wrapped each
 * section in `wrap={false}`, which cannot keep a >1-page block whole and made
 * react-pdf clip it — silently dropping legal text from a SIGNED document.
 *
 * These render for real (no mocks) and assert on the page count reported in
 * the PDF's own /Type /Page objects.
 */
function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

function docWith(paragraphs: string[], language: 'he' | 'en'): AgreementPdfData {
  return {
    language,
    document: {
      title: language === 'he' ? 'הסכם התקשרות' : 'Engagement Agreement',
      preamble: language === 'he' ? 'בין הלקוח לבין המשרד.' : 'Between the Client and the Firm.',
      sections: [
        { title: language === 'he' ? 'סעיף ארוך' : 'Long clause', paragraphs },
        {
          title: language === 'he' ? 'הסעיף האחרון' : 'Final clause',
          paragraphs: [language === 'he' ? 'שורה אחרונה קריטית.' : 'Critical final line.'],
        },
      ],
    },
    clientName: language === 'he' ? 'ישראל ישראלי' : 'John Doe',
    clientNationalId: '123456782',
    clientPhone: '050-1234567',
    clientEmail: 'client@example.test',
    signaturePngDataUrl: null,
    signedAtText: '31/08/2026, 10:00',
    signerIp: '1.2.3.4',
    agreementVersion: '2026-08.2',
  };
}

const LONG_HE =
  'סעיף ארוך מאוד שהמשרד הוסיף לנוסח ההסכם בעריכה עצמית של הטקסט המשפטי, כדי לוודא שהמסמך נשאר שלם. ';
const LONG_EN =
  'A very long clause the office added to the agreement wording while editing the legal text, to make sure the document stays intact. ';

describe('agreement PDF — long office-edited wording', () => {
  it('flows a multi-page Hebrew section onto additional pages instead of clipping it', async () => {
    const pdf = await renderToBuffer(
      AgreementPdfDocument({ data: docWith(Array.from({ length: 24 }, () => LONG_HE.repeat(10)), 'he') }),
    );
    expect(pageCount(pdf)).toBeGreaterThan(1);
  }, 60_000);

  it('does the same in English', async () => {
    const pdf = await renderToBuffer(
      AgreementPdfDocument({ data: docWith(Array.from({ length: 24 }, () => LONG_EN.repeat(10)), 'en') }),
    );
    expect(pageCount(pdf)).toBeGreaterThan(1);
  }, 60_000);

  it('still renders a short agreement on a single page', async () => {
    const pdf = await renderToBuffer(AgreementPdfDocument({ data: docWith(['פסקה קצרה.'], 'he') }));
    expect(pageCount(pdf)).toBe(1);
  }, 60_000);
});
