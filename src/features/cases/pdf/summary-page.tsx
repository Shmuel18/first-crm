import { Page, Text, View } from '@react-pdf/renderer';

import type { Locale } from '@/lib/i18n/direction';

import type { BankPdfData } from './bank-pdf-data.service';
import { fmtCurrency } from './formatters';
import { PageFooter, SummaryCell4 } from './shared';
import type { PdfStrings } from './strings';
import { COLOR_MUTED, styles } from './styles';

/**
 * Page 3: the punchline. Mortgage underwriters look at this page first.
 *
 * Sections:
 *   1. Income / obligations split by role (borrowers vs guarantors)
 *   2. Available-income highlight (income − long-term obligations)
 *   3. DTI bands (30 / 34 / 38%) — possible monthly payment at each ratio
 *   4. Notes placeholder
 *   5. Thanks + signature block (advisor name + phone + email)
 */
export function SummaryPage({
  data,
  strings,
  locale,
}: {
  data: BankPdfData;
  strings: PdfStrings;
  locale: Locale;
}) {
  const dash = strings.values.dash;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>{strings.summary.title}</Text>

      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 9, color: COLOR_MUTED, marginBottom: 6, textAlign: 'right' }}>
          {strings.summary.incomeExpenseHeader(data.borrowers.length)}
        </Text>
        <View style={styles.summary4}>
          <SummaryCell4
            label={strings.summary.borrowersIncome}
            value={fmtCurrency(data.totals.borrowersIncomeMonthly, locale, dash)}
          />
          <SummaryCell4
            label={strings.summary.borrowersObligationsLT}
            value={fmtCurrency(data.totals.borrowersObligationsLongTermMonthly, locale, dash)}
          />
          <SummaryCell4
            label={strings.summary.guarantorsIncome}
            value={fmtCurrency(data.totals.guarantorsIncomeMonthly, locale, dash)}
          />
          <SummaryCell4
            label={strings.summary.guarantorsObligationsLT}
            value={fmtCurrency(data.totals.guarantorsObligationsLongTermMonthly, locale, dash)}
            last
          />
        </View>
      </View>

      {/* Available income highlight */}
      <View style={styles.availableBox}>
        <Text style={styles.availableLabel}>{strings.summary.availableIncome}</Text>
        <Text style={styles.availableValue}>
          {fmtCurrency(data.totals.availableIncomeMonthly, locale, dash)}
        </Text>
      </View>

      {/* DTI bands */}
      <Text style={styles.bandsTitle}>{strings.summary.bandsTitle}</Text>
      <View style={styles.bandsGrid}>
        {data.totals.paymentBands.map((band, idx, arr) => (
          <View
            key={band.ratio}
            style={
              idx === arr.length - 1
                ? [styles.bandCell, styles.bandCellLast]
                : styles.bandCell
            }
          >
            <Text style={styles.bandRatio}>{strings.summary.bandRatio(band.ratio)}</Text>
            <Text style={styles.bandPayment}>{fmtCurrency(band.payment, locale, dash)}</Text>
          </View>
        ))}
      </View>

      {/* Notes placeholder */}
      <Text style={[styles.bandsTitle, { marginTop: 22 }]}>{strings.summary.notesTitle}</Text>
      <View style={styles.notesBox} />

      {/* Thanks + signature */}
      <Text style={styles.thanksLine}>{strings.summary.thanks}</Text>
      <View style={styles.signatureBlock}>
        <View style={styles.signatureLine} />
        {data.advisorName && <Text style={styles.signatureName}>{data.advisorName}</Text>}
        {(data.advisorPhone || data.advisorEmail) && (
          <Text style={styles.signatureMeta}>
            {[data.advisorPhone, data.advisorEmail].filter(Boolean).join(' · ')}
          </Text>
        )}
        {!data.advisorName && (
          <Text style={styles.signatureMeta}>{strings.summary.signatureFallback}</Text>
        )}
      </View>

      <PageFooter strings={strings} />
    </Page>
  );
}
