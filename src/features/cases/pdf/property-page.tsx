import { Page, Text, View } from '@react-pdf/renderer';

import type { BankPdfData } from './bank-pdf-data.service';
import { fmtCurrency, fmtNum } from './formatters';
import { PageFooter, SummaryCell4 } from './shared';
import { COLOR_MUTED, styles } from './styles';

/**
 * Page 2: property summary (4-cell grid: value / equity / requested / LTV)
 * + combined obligations table covering all borrowers, with a long-term
 * checkmark on debts the bank counts toward DTI (>18 months remaining).
 */
export function PropertyPage({ data }: { data: BankPdfData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>פרטי הבקשה</Text>
      <View style={styles.summary4}>
        <SummaryCell4 label="שווי הנכס" value={fmtCurrency(data.case.propertyValue)} />
        <SummaryCell4 label="הון עצמי" value={fmtCurrency(data.case.equity)} />
        <SummaryCell4 label="סכום מבוקש" value={fmtCurrency(data.case.requestedAmount)} />
        <SummaryCell4
          label="אחוז מימון (LTV)"
          value={data.case.ltv === null ? '—' : `${data.case.ltv.toFixed(1)}%`}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>התחייבויות / הלוואות</Text>
      <ObligationsTable data={data} />

      <PageFooter />
    </Page>
  );
}

function ObligationsTable({ data }: { data: BankPdfData }) {
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
          אין התחייבויות / הלוואות
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 1.4 }]}>שם הלווה</Text>
        <Text style={[styles.th, { flex: 1.3 }]}>מלווה</Text>
        <Text style={[styles.th, { flex: 2 }]}>תיאור</Text>
        <Text style={[styles.th, { flex: 1.2 }]}>יתרת הלוואה</Text>
        <Text style={[styles.th, { flex: 1 }]}>חודשים נותרו</Text>
        <Text style={[styles.th, styles.thLast, { flex: 1.1 }]}>החזר חודשי</Text>
      </View>
      {rows.map((r, idx) => (
        <View key={idx} style={styles.tr}>
          <Text style={[styles.td, { flex: 1.4 }]}>{r.borrowerName}</Text>
          <Text style={[styles.td, { flex: 1.3 }]}>{r.lender ?? '—'}</Text>
          <Text style={[styles.td, { flex: 2 }]}>{r.description ?? '—'}</Text>
          <Text style={[styles.td, { flex: 1.2 }]}>{fmtCurrency(r.loanAmount)}</Text>
          <Text style={[styles.td, { flex: 1 }]}>
            {r.monthsRemaining === null ? '—' : fmtNum(r.monthsRemaining)}
            {r.isLongTerm && <Text style={styles.longTermBadge}> ✓</Text>}
          </Text>
          <Text style={[styles.td, styles.tdLast, { flex: 1.1 }]}>
            {fmtCurrency(r.monthlyPayment)}
          </Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={[styles.totalCell, { flex: 4.7 }]}>סה״כ</Text>
        <Text style={[styles.totalCell, { flex: 1.2 }]}>
          {fmtCurrency(data.totals.grandRemainingDebt)}
        </Text>
        <Text style={[styles.totalCell, { flex: 1 }]}>—</Text>
        <Text style={[styles.totalCell, { flex: 1.1, borderLeft: 'none' }]}>
          {fmtCurrency(data.totals.grandObligationsMonthly)}
        </Text>
      </View>
      <View style={styles.obligationsFootnote}>
        <Text style={{ fontSize: 8, color: COLOR_MUTED }}>
          ✓ = החזר נכלל בחישוב יחס החזר לבנק (מעל 18 חודשים נותרו)
        </Text>
      </View>
    </View>
  );
}
