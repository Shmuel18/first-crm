import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { ensureHebrewFontRegistered } from '@/features/cases/pdf/fonts';
import { BRAND } from '@/lib/brand';
import { formatCurrency } from '@/lib/utils/format-currency';

import { agreementBalance } from '../domain/agreement-calc';
import { AGREEMENT_TITLE, buildAgreementSections } from '../domain/agreement-text';

/**
 * The signed engagement-agreement PDF: the same clauses the client saw on the
 * /sign page (one source: domain/agreement-text), the fee terms, the client's
 * identity, the drawn signature and an evidence line (when/IP). Hebrew-only,
 * like the agreement itself.
 *
 * RTL per house rules (features/cases/pdf/styles.ts): react-pdf doesn't
 * cascade `direction`, so rows are `row-reverse` and Texts get
 * `textAlign: 'right'`. `direction: 'rtl'` is only applied to full-width
 * Texts — on a shrink-to-fit node it collapses the text silently.
 */
ensureHebrewFontRegistered();

export type AgreementPdfData = {
  clientName: string;
  clientNationalId: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  feeTotal: number;
  feeAdvance: number;
  /** base64 PNG data URL of the drawn signature; null renders a blank line. */
  signaturePngDataUrl: string | null;
  /** Pre-formatted Israel-time date strings (no Date.now() in render). */
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
  title: { fontSize: 17, fontWeight: 600, textAlign: 'center', direction: 'rtl' },
  office: { fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 4, direction: 'rtl' },
  titleRule: { borderBottom: `2 solid ${GOLD}`, marginTop: 10, marginBottom: 14 },
  partyBox: {
    backgroundColor: '#FAF8F3',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  partyLine: { fontSize: 10, textAlign: 'right', direction: 'rtl', marginBottom: 2 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'right',
    direction: 'rtl',
    marginTop: 12,
    marginBottom: 4,
    color: INK,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    textAlign: 'right',
    direction: 'rtl',
    marginBottom: 3,
  },
  signatures: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 26,
  },
  signatureCell: { width: 220 },
  signatureImage: { width: 160, height: 60, objectFit: 'contain', alignSelf: 'flex-end' },
  signatureLine: { borderBottom: `1 solid ${INK}`, height: 46, width: 200, alignSelf: 'flex-end' },
  signatureLabel: {
    fontSize: 9,
    fontWeight: 600,
    textAlign: 'right',
    direction: 'rtl',
    marginTop: 4,
  },
  signatureMeta: { fontSize: 8, color: MUTED, textAlign: 'right', direction: 'rtl' },
  evidence: {
    marginTop: 18,
    paddingTop: 6,
    borderTop: `0.5 solid ${LINE}`,
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'right',
    direction: 'rtl',
  },
});

function currency(n: number): string {
  return formatCurrency(n, 'he');
}

export function AgreementPdfDocument({ data }: { data: AgreementPdfData }) {
  const sections = buildAgreementSections({
    officeName: BRAND.nameHe,
    officePhone: BRAND.contact.phone ?? '',
    officeEmail: BRAND.contact.email ?? '',
    feeTotalText: currency(data.feeTotal),
    feeAdvanceText: currency(data.feeAdvance),
    feeBalanceText: currency(agreementBalance(data.feeTotal, data.feeAdvance)),
  });

  const clientDetails = [
    `שם מלא: ${data.clientName}`,
    data.clientNationalId ? `ת.ז.: ${data.clientNationalId}` : null,
    data.clientPhone ? `טלפון: ${data.clientPhone}` : null,
    data.clientEmail ? `דוא"ל: ${data.clientEmail}` : null,
  ].filter((v): v is string => v !== null);

  return (
    <Document title={AGREEMENT_TITLE}>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{AGREEMENT_TITLE}</Text>
        <Text style={s.office}>{BRAND.taglineHe}</Text>
        <View style={s.titleRule} />

        <View style={s.partyBox}>
          <Text style={s.partyLine}>{`בין: ${BRAND.nameHe} ("המשרד")`}</Text>
          <Text style={s.partyLine}>{`לבין הלקוח: ${clientDetails.join(' | ')}`}</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((p) => (
              <Text key={p.slice(0, 24)} style={s.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <View style={s.signatures}>
          <View style={s.signatureCell}>
            {data.signaturePngDataUrl ? (
              <Image src={data.signaturePngDataUrl} style={s.signatureImage} />
            ) : (
              <View style={s.signatureLine} />
            )}
            <Text style={s.signatureLabel}>{`חתימת הלקוח: ${data.clientName}`}</Text>
            {data.signedAtText && (
              <Text style={s.signatureMeta}>{`תאריך: ${data.signedAtText}`}</Text>
            )}
          </View>
          <View style={s.signatureCell}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>{`המשרד: ${BRAND.nameHe}`}</Text>
          </View>
        </View>

        <Text style={s.evidence}>
          {[
            `גרסת הסכם: ${data.agreementVersion}`,
            data.signedAtText ? `נחתם דיגיטלית: ${data.signedAtText}` : null,
            data.signerIp ? `כתובת IP: ${data.signerIp}` : null,
          ]
            .filter(Boolean)
            .join('  |  ')}
        </Text>
      </Page>
    </Document>
  );
}
