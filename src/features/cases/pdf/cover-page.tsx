import { Page, Text, View } from '@react-pdf/renderer';

import type { BankPdfData } from './bank-pdf-data.service';
import {
  fmtCurrency,
  fmtDate,
  fmtNum,
  GENDER_LABELS,
  MARITAL_LABELS,
  RESIDENCY_LABELS,
  ROLE_LABELS,
} from './formatters';
import { MetaItem, PageFooter } from './shared';
import { styles } from './styles';

/**
 * Page 1: cover header (title with borrower names, brand block, requested
 * amount, date stamp) + meta strip + side-by-side borrower table.
 *
 * Title format: first 3 borrower names joined with " ו ", suffixed with
 * " ועוד N" if there are more. Matches the WISE/Hershkovitz convention.
 */
export function CoverPage({ data }: { data: BankPdfData }) {
  const generatedAt = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const titleNames = data.borrowers.slice(0, 3).map((b) => b.fullName);
  const titleSuffix = data.borrowers.length > 3 ? ` ועוד ${data.borrowers.length - 3}` : '';
  const title = titleNames.join(' ו') + titleSuffix;

  return (
    <Page size="A4" style={styles.page}>
      {/* Cover header */}
      <View style={styles.cover}>
        <View style={styles.coverRight}>
          <Text style={styles.coverTitle}>{title}</Text>
          <Text style={styles.coverSubtitle}>
            סכום המשכנתא המבוקש: {fmtCurrency(data.case.requestedAmount)}
          </Text>
          <Text style={styles.coverDate}>{generatedAt}</Text>
        </View>
        <View style={styles.brandBlock}>
          <View style={styles.brandBar} />
          <Text style={styles.brandName}>Kaufman Finance Group</Text>
          <Text style={styles.brandSub}>קופמן ייעוץ משכנתאות</Text>
        </View>
      </View>
      <View style={styles.coverRule} />

      {/* Meta strip */}
      <View style={styles.metaStrip}>
        <MetaItem label="מספר תיק" value={data.case.caseNumber} />
        <MetaItem label="נפתח" value={fmtDate(data.case.createdAt)} />
        {data.case.statusName && <MetaItem label="סטטוס" value={data.case.statusName} />}
        {data.advisorName && <MetaItem label="יועץ" value={data.advisorName} />}
      </View>

      {/* Customer details */}
      <Text style={styles.sectionTitle}>
        פרטי הלקוחות ({data.borrowers.length}{' '}
        {data.borrowers.length === 1 ? 'לווה' : 'לווים'})
      </Text>
      <BorrowerTable borrowers={data.borrowers} />

      <PageFooter />
    </Page>
  );
}

/**
 * Side-by-side borrower table: rows are fields, columns are borrowers.
 * Compresses gracefully — 1 borrower = 2 cols, 2 borrowers = 3 cols, etc.
 * Above ~4 borrowers the columns get tight; for v1 we accept that.
 *
 * `fieldRows` is built imperatively so each row carries its own value
 * map per borrower — keeps the JSX flat and easy to skim.
 */
function BorrowerTable({ borrowers }: { borrowers: BankPdfData['borrowers'] }) {
  const fieldRows = buildFieldRows(borrowers);

  return (
    <View style={styles.sbsTable}>
      {/* Header row: empty label cell + borrower column headers */}
      <View style={styles.sbsHeader}>
        <Text style={[styles.sbsHeaderCell, styles.sbsLabelCell]}>פרטי הלווה</Text>
        {borrowers.map((b, idx) => (
          <Text
            key={b.id}
            style={
              idx === borrowers.length - 1
                ? [styles.sbsHeaderCell, styles.sbsHeaderCellLast]
                : styles.sbsHeaderCell
            }
          >
            לווה {idx + 1}
          </Text>
        ))}
      </View>
      {/* Field rows */}
      {fieldRows.map((row) => (
        <View key={row.label} style={styles.sbsRow}>
          <Text style={[styles.sbsCell, styles.sbsLabelCell]}>{row.label}</Text>
          {row.values.map((v, idx) => (
            <Text
              key={idx}
              style={
                idx === row.values.length - 1
                  ? [styles.sbsCell, styles.sbsCellLast]
                  : styles.sbsCell
              }
            >
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

type Row = { label: string; values: string[] };

function buildFieldRows(borrowers: BankPdfData['borrowers']): Row[] {
  return [
    {
      label: 'תפקיד בתיק',
      values: borrowers.map((b) => `${ROLE_LABELS[b.role]}${b.isPrimary ? ' (ראשי)' : ''}`),
    },
    { label: 'שם ושם משפחה', values: borrowers.map((b) => b.fullName) },
    { label: 'מספר ת״ז', values: borrowers.map((b) => b.nationalId ?? '—') },
    { label: 'תאריך הנפקת ת״ז', values: borrowers.map((b) => fmtDate(b.idIssueDate)) },
    { label: 'תוקף ת״ז', values: borrowers.map((b) => fmtDate(b.idExpiryDate)) },
    { label: 'תאריך לידה', values: borrowers.map((b) => fmtDate(b.birthDate)) },
    {
      label: 'גיל',
      values: borrowers.map((b) => (b.ageYears === null ? '—' : String(b.ageYears))),
    },
    {
      label: 'מגדר',
      values: borrowers.map((b) => (b.gender ? (GENDER_LABELS[b.gender] ?? b.gender) : '—')),
    },
    {
      label: 'מצב משפחתי',
      values: borrowers.map((b) =>
        b.maritalStatus ? (MARITAL_LABELS[b.maritalStatus] ?? b.maritalStatus) : '—',
      ),
    },
    {
      label: 'מספר ילדים עד גיל 18',
      values: borrowers.map((b) =>
        b.childrenCount === null ? '—' : String(b.childrenCount),
      ),
    },
    { label: 'טלפון נייד', values: borrowers.map((b) => b.phone ?? '—') },
    { label: 'דואר אלקטרוני', values: borrowers.map((b) => b.email ?? '—') },
    { label: 'כתובת מגורים', values: borrowers.map((b) => b.address ?? '—') },
    { label: 'אזרחות', values: borrowers.map((b) => b.citizenship ?? 'ישראלית') },
    {
      label: 'תושבות',
      values: borrowers.map((b) =>
        b.residencyType ? (RESIDENCY_LABELS[b.residencyType] ?? b.residencyType) : '—',
      ),
    },
    {
      label: 'הכנסה חודשית ממוצעת נטו',
      values: borrowers.map((b) => fmtCurrency(b.monthlyIncomeTotal)),
    },
    {
      label: 'מקור הכנסה עיקרי',
      values: borrowers.map((b) => {
        const primary = b.incomes[0];
        if (!primary) return '—';
        return [primary.typeName, primary.sourceName].filter(Boolean).join(' · ') || '—';
      }),
    },
    {
      label: 'וותק הכנסה עיקרית (חודשים)',
      values: borrowers.map((b) => {
        const primary = b.incomes[0];
        return primary?.tenureMonths === null || primary?.tenureMonths === undefined
          ? '—'
          : fmtNum(primary.tenureMonths);
      }),
    },
  ];
}
