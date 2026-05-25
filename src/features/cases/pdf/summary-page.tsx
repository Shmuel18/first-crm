import { Page, Text, View } from '@react-pdf/renderer';

import type { BankPdfData } from './bank-pdf-data.service';
import { fmtCurrency } from './formatters';
import { PageFooter, SummaryCell4 } from './shared';
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
export function SummaryPage({ data }: { data: BankPdfData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>דוח סיכום לבקשת המשכנתא</Text>

      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 9, color: COLOR_MUTED, marginBottom: 6, textAlign: 'right' }}>
          סיכום הכנסות / הוצאות ({data.borrowers.length}{' '}
          {data.borrowers.length === 1 ? 'לווה' : 'לווים'})
        </Text>
        <View style={styles.summary4}>
          <SummaryCell4
            label="הכנסות לווים"
            value={fmtCurrency(data.totals.borrowersIncomeMonthly)}
          />
          <SummaryCell4
            label="התחייבויות לווים (מעל 18 חודשים)"
            value={fmtCurrency(data.totals.borrowersObligationsLongTermMonthly)}
          />
          <SummaryCell4
            label="הכנסות ערבים"
            value={fmtCurrency(data.totals.guarantorsIncomeMonthly)}
          />
          <SummaryCell4
            label="התחייבויות ערבים (מעל 18 חודשים)"
            value={fmtCurrency(data.totals.guarantorsObligationsLongTermMonthly)}
            last
          />
        </View>
      </View>

      {/* Available income highlight */}
      <View style={styles.availableBox}>
        <Text style={styles.availableLabel}>הכנסה פנויה לבקשה</Text>
        <Text style={styles.availableValue}>
          {fmtCurrency(data.totals.availableIncomeMonthly)}
        </Text>
      </View>

      {/* DTI bands */}
      <Text style={styles.bandsTitle}>החזר חודשי אפשרי לפי יחס החזר</Text>
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
            <Text style={styles.bandRatio}>יחס החזר {band.ratio}%</Text>
            <Text style={styles.bandPayment}>{fmtCurrency(band.payment)}</Text>
          </View>
        ))}
      </View>

      {/* Notes placeholder */}
      <Text style={[styles.bandsTitle, { marginTop: 22 }]}>הערות</Text>
      <View style={styles.notesBox} />

      {/* Thanks + signature */}
      <Text style={styles.thanksLine}>תודה מראש,</Text>
      <View style={styles.signatureBlock}>
        <View style={styles.signatureLine} />
        {data.advisorName && <Text style={styles.signatureName}>{data.advisorName}</Text>}
        {(data.advisorPhone || data.advisorEmail) && (
          <Text style={styles.signatureMeta}>
            {[data.advisorPhone, data.advisorEmail].filter(Boolean).join(' · ')}
          </Text>
        )}
        {!data.advisorName && <Text style={styles.signatureMeta}>חתימת היועץ</Text>}
      </View>

      <PageFooter />
    </Page>
  );
}
