import { Page, Text, View } from '@react-pdf/renderer';

import type { Locale } from '@/lib/i18n/direction';

import type { BankPdfData } from './bank-pdf-data.service';
import { fmtCurrency, fmtNum } from './formatters';
import { PageFooter, SummaryCell4 } from './shared';
import type { PdfStrings } from './strings';
import { COLOR_MUTED, styles } from './styles';

/**
 * Page 2: property summary (4-cell grid: value / equity / requested / LTV)
 * + combined obligations table covering all borrowers, with a long-term
 * checkmark on debts the bank counts toward DTI (>18 months remaining).
 */
export function PropertyPage({
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
      <Text style={styles.sectionTitle}>{strings.property.title}</Text>
      <View style={styles.summary4}>
        <SummaryCell4
          label={strings.property.propertyValue}
          value={fmtCurrency(data.case.propertyValue, locale, dash)}
        />
        <SummaryCell4
          label={strings.property.equity}
          value={fmtCurrency(data.case.equity, locale, dash)}
        />
        <SummaryCell4
          label={strings.property.requestedAmount}
          value={fmtCurrency(data.case.requestedAmount, locale, dash)}
        />
        <SummaryCell4
          label={strings.property.ltv}
          value={data.case.ltv === null ? dash : `${data.case.ltv.toFixed(1)}%`}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>{strings.property.obligationsTitle}</Text>
      <ObligationsTable data={data} strings={strings} locale={locale} />

      <PageFooter strings={strings} />
    </Page>
  );
}

function ObligationsTable({
  data,
  strings,
  locale,
}: {
  data: BankPdfData;
  strings: PdfStrings;
  locale: Locale;
}) {
  const dash = strings.values.dash;
  const rows = data.borrowers.flatMap((b) =>
    b.obligations.map((ob) => ({
      borrowerName: b.fullName,
      lender: ob.lender,
      description: ob.description,
      monthsRemaining: ob.monthsRemaining,
      monthlyPayment: ob.monthlyPayment,
      loanAmount: ob.loanAmount,
      isLongTerm: ob.isLongTerm,
    })),
  );

  if (rows.length === 0) {
    return (
      <View style={styles.emptyObligationsBox}>
        <Text style={{ fontSize: 9, color: COLOR_MUTED, textAlign: 'right' }}>
          {strings.property.obligationsEmpty}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 1.4 }]}>{strings.property.columns.borrowerName}</Text>
        <Text style={[styles.th, { flex: 1.3 }]}>{strings.property.columns.lender}</Text>
        <Text style={[styles.th, { flex: 2 }]}>{strings.property.columns.description}</Text>
        <Text style={[styles.th, { flex: 1.2 }]}>{strings.property.columns.loanAmount}</Text>
        <Text style={[styles.th, { flex: 1 }]}>{strings.property.columns.monthsRemaining}</Text>
        <Text style={[styles.th, styles.thLast, { flex: 1.1 }]}>
          {strings.property.columns.monthlyPayment}
        </Text>
      </View>
      {rows.map((r, idx) => (
        <View key={idx} style={styles.tr}>
          <Text style={[styles.td, { flex: 1.4 }]}>{r.borrowerName}</Text>
          <Text style={[styles.td, { flex: 1.3 }]}>{r.lender ?? dash}</Text>
          <Text style={[styles.td, { flex: 2 }]}>{r.description ?? dash}</Text>
          <Text style={[styles.td, { flex: 1.2 }]}>{fmtCurrency(r.loanAmount, locale, dash)}</Text>
          <Text style={[styles.td, { flex: 1 }]}>
            {r.monthsRemaining === null ? dash : fmtNum(r.monthsRemaining, locale, dash)}
            {r.isLongTerm && <Text style={styles.longTermBadge}> ✓</Text>}
          </Text>
          <Text style={[styles.td, styles.tdLast, { flex: 1.1 }]}>
            {fmtCurrency(r.monthlyPayment, locale, dash)}
          </Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={[styles.totalCell, { flex: 4.7 }]}>{strings.property.totalRow}</Text>
        <Text style={[styles.totalCell, { flex: 1.2 }]}>
          {fmtCurrency(data.totals.grandRemainingDebt, locale, dash)}
        </Text>
        <Text style={[styles.totalCell, { flex: 1 }]}>{dash}</Text>
        <Text style={[styles.totalCell, { flex: 1.1, borderLeft: 'none' }]}>
          {fmtCurrency(data.totals.grandObligationsMonthly, locale, dash)}
        </Text>
      </View>
      <View style={styles.obligationsFootnote}>
        {/* Leading "✓ =" drifts under the default LTR base; force RTL so the
            marker stays at the start of the Hebrew line. */}
        <Text style={{ fontSize: 8, color: COLOR_MUTED, direction: locale === 'he' ? 'rtl' : 'ltr' }}>
          {strings.property.longTermFootnote}
        </Text>
      </View>
    </View>
  );
}
