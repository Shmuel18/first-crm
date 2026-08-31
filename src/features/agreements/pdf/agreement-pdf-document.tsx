import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { ensureHebrewFontRegistered } from '@/features/cases/pdf/fonts';
import { BRAND } from '@/lib/brand';

import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';

/**
 * The signed engagement-agreement PDF. The wording arrives ALREADY RENDERED
 * (placeholders substituted, office edits applied) from the row's snapshot, so
 * this component is a pure function of (document, signature evidence) — what
 * the client signed is what prints, forever.
 *
 * RTL per house rules (features/cases/pdf/styles.ts): react-pdf doesn't cascade
 * `direction`, so Hebrew rows are `row-reverse` and Texts carry an explicit
 * direction. `direction` is only applied to FULL-WIDTH Texts — on a
 * shrink-to-fit node it collapses the text silently.
 */
ensureHebrewFontRegistered();

export type AgreementPdfData = {
  language: AgreementLanguage;
  document: AgreementDocument;
  clientName: string;
  clientNationalId: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  /** base64 PNG data URL of the drawn signature; null renders a blank line. */
  signaturePngDataUrl: string | null;
  /** Pre-formatted Israel-time date string (no Date.now() in render). */
  signedAtText: string | null;
  signerIp: string | null;
  agreementVersion: string;
};

const INK = BRAND.colors.ink;
const MUTED = '#525252';
const LINE = '#E5E5E5';
const GOLD = BRAND.colors.gold;

const s = StyleSheet.create({
  page: { fontFamily: 'Heebo', fontSize: 10, color: INK, padding: 42, paddingBottom: 56 },
  title: { fontSize: 17, fontWeight: 600, textAlign: 'center' },
  office: { fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 4 },
  titleRule: { borderBottom: `2 solid ${GOLD}`, marginTop: 10, marginBottom: 14 },
  partyBox: { backgroundColor: '#FAF8F3', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 },
  partyLine: { fontSize: 10, marginBottom: 2 },
  sectionTitle: { fontSize: 11, fontWeight: 600, marginTop: 12, marginBottom: 4, color: INK },
  paragraph: { fontSize: 10, lineHeight: 1.55, marginBottom: 3 },
  signatures: { justifyContent: 'space-between', marginTop: 26 },
  signatureCell: { width: 220 },
  signatureImage: { width: 160, height: 60, objectFit: 'contain' },
  signatureLine: { borderBottom: `1 solid ${INK}`, height: 46, width: 200 },
  signatureLabel: { fontSize: 9, fontWeight: 600, marginTop: 4 },
  signatureMeta: { fontSize: 8, color: MUTED },
  evidence: {
    marginTop: 18,
    paddingTop: 6,
    borderTop: `0.5 solid ${LINE}`,
    fontSize: 7.5,
    color: MUTED,
  },
});

/** Hebrew is RTL; English keeps react-pdf's LTR default. */
function dirStyle(he: boolean): { direction: 'rtl' | 'ltr'; textAlign: 'right' | 'left' } {
  return he ? { direction: 'rtl', textAlign: 'right' } : { direction: 'ltr', textAlign: 'left' };
}

const LABELS = {
  he: {
    tagline: BRAND.taglineHe,
    fullName: 'שם מלא',
    idNo: 'ת.ז.',
    phone: 'טלפון',
    email: 'דוא"ל',
    client: 'הלקוח',
    clientSignature: 'חתימת הלקוח',
    firm: 'המשרד',
    date: 'תאריך',
    version: 'גרסת הסכם',
    signedDigitally: 'נחתם דיגיטלית',
    ip: 'כתובת IP',
  },
  en: {
    tagline: BRAND.taglineEn,
    fullName: 'Full name',
    idNo: 'ID/Passport No.',
    phone: 'Phone',
    email: 'Email',
    client: 'Client',
    clientSignature: "Client's signature",
    firm: 'For and on behalf of the Firm',
    date: 'Date',
    version: 'Agreement version',
    signedDigitally: 'Signed digitally',
    ip: 'IP address',
  },
} as const;

export function AgreementPdfDocument({ data }: { data: AgreementPdfData }) {
  const he = data.language === 'he';
  const dir = dirStyle(he);
  const t = LABELS[data.language];
  const rowDir = { flexDirection: he ? ('row-reverse' as const) : ('row' as const) };
  const cellAlign = { alignItems: he ? ('flex-end' as const) : ('flex-start' as const) };

  const clientDetails = [
    `${t.fullName}: ${data.clientName}`,
    data.clientNationalId ? `${t.idNo} ${data.clientNationalId}` : null,
    data.clientPhone ? `${t.phone}: ${data.clientPhone}` : null,
    data.clientEmail ? `${t.email}: ${data.clientEmail}` : null,
  ].filter((v): v is string => v !== null);

  return (
    <Document title={data.document.title}>
      <Page size="A4" style={s.page}>
        <Text style={[s.title, dir]}>{data.document.title}</Text>
        <Text style={[s.office, dir]}>{t.tagline}</Text>
        <View style={s.titleRule} />

        <View style={s.partyBox}>
          <Text style={[s.partyLine, dir]}>{data.document.preamble}</Text>
          <Text style={[s.partyLine, dir]}>{`${t.client}: ${clientDetails.join(' | ')}`}</Text>
        </View>

        {/* Sections deliberately WRAP across pages. `wrap={false}` would keep a
            section whole, but the office can now write arbitrarily long clauses
            in Settings, and a block taller than one page cannot be kept whole —
            react-pdf then clips it, which would silently drop legal text from
            the signed document. A heading landing near a page break is the
            acceptable cost; `minPresenceAhead` keeps that rare. */}
        {data.document.sections.map((section) => (
          <View key={section.title}>
            <Text style={[s.sectionTitle, dir]} minPresenceAhead={40}>
              {section.title}
            </Text>
            {section.paragraphs.map((p) => (
              <Text key={p.slice(0, 32)} style={[s.paragraph, dir]}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <View style={[s.signatures, rowDir]}>
          <View style={[s.signatureCell, cellAlign]}>
            {data.signaturePngDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt
              <Image src={data.signaturePngDataUrl} style={s.signatureImage} />
            ) : (
              <View style={s.signatureLine} />
            )}
            <Text style={[s.signatureLabel, dir]}>
              {`${t.clientSignature}: ${data.clientName}`}
            </Text>
            {data.signedAtText && (
              <Text style={[s.signatureMeta, dir]}>{`${t.date}: ${data.signedAtText}`}</Text>
            )}
          </View>
          <View style={[s.signatureCell, cellAlign]}>
            <View style={s.signatureLine} />
            <Text style={[s.signatureLabel, dir]}>
              {`${t.firm}: ${he ? BRAND.nameHe : BRAND.nameEn}`}
            </Text>
          </View>
        </View>

        <Text style={[s.evidence, dir]}>
          {[
            `${t.version}: ${data.agreementVersion}`,
            data.signedAtText ? `${t.signedDigitally}: ${data.signedAtText}` : null,
            data.signerIp ? `${t.ip}: ${data.signerIp}` : null,
          ]
            .filter(Boolean)
            .join('  |  ')}
        </Text>
      </Page>
    </Document>
  );
}
