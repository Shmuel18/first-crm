import { Page, Text, View } from '@react-pdf/renderer';

import type { RoleInCase } from '@/features/borrowers/types';
import type { Locale } from '@/lib/i18n/direction';

import type { BankPdfData } from './bank-pdf-data.service';
import { fmtCurrency, fmtDate, fmtNum } from './formatters';
import { MetaItem, PageFooter } from './shared';
import type { PdfStrings } from './strings';
import { styles } from './styles';

/**
 * Page 1: cover header (title with borrower names, brand block, requested
 * amount, date stamp) + meta strip + side-by-side borrower table.
 *
 * Title format: first 3 borrower names joined with the locale connector,
 * suffixed with "…and N more" if there are more.
 */
export function CoverPage({
  data,
  strings,
  locale,
}: {
  data: BankPdfData;
  strings: PdfStrings;
  locale: Locale;
}) {
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const generatedAt = new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const titleNames = data.borrowers.slice(0, 3).map((b) => b.fullName);
  const titleSuffix =
    data.borrowers.length > 3 ? strings.cover.titleSuffix(data.borrowers.length - 3) : '';
  const title = titleNames.join(strings.cover.titleConnector) + titleSuffix;

  return (
    <Page size="A4" style={styles.page}>
      {/* Cover header — intentionally unbranded: a bank submission carries no
          office name or logo, just the request itself (product decision). */}
      <View style={styles.cover}>
        <View style={styles.coverRight}>
          <Text style={[styles.coverTitle, { direction: dir }]}>{title}</Text>
          {/* Label (RTL Hebrew) and amount (LTR number+₪) are separate Texts so
              the shekel sign can't drift across the bidi boundary. */}
          <View style={styles.coverSubtitleRow}>
            <Text style={[styles.coverSubtitle, { direction: dir }]}>
              {strings.cover.requestedAmountLabel}
            </Text>
            <Text style={styles.coverSubtitle}>
              {fmtCurrency(data.case.requestedAmount, locale, strings.values.dash)}
            </Text>
          </View>
          <Text style={styles.coverDate}>{generatedAt}</Text>
        </View>
      </View>
      <View style={styles.coverRule} />

      {/* Meta strip */}
      <View style={styles.metaStrip}>
        <MetaItem label={strings.cover.metaCaseNumber} value={data.case.caseNumber} />
        <MetaItem
          label={strings.cover.metaOpened}
          value={fmtDate(data.case.createdAt, locale, strings.values.dash)}
        />
        {data.case.statusName && (
          <MetaItem label={strings.cover.metaStatus} value={data.case.statusName} />
        )}
        {data.advisorName && (
          <MetaItem label={strings.cover.metaAdvisor} value={data.advisorName} />
        )}
      </View>

      {/* Customer details */}
      <Text style={styles.sectionTitle}>
        {strings.cover.customerDetails(data.borrowers.length)}
      </Text>
      <BorrowerTable borrowers={data.borrowers} strings={strings} locale={locale} />

      <PageFooter strings={strings} />
    </Page>
  );
}

function BorrowerTable({
  borrowers,
  strings,
  locale,
}: {
  borrowers: BankPdfData['borrowers'];
  strings: PdfStrings;
  locale: Locale;
}) {
  const fieldRows = buildFieldRows(borrowers, strings, locale);

  return (
    <View style={styles.sbsTable}>
      <View style={styles.sbsHeader}>
        <Text style={[styles.sbsHeaderCell, styles.sbsLabelCell]}>
          {strings.cover.borrowerHeader}
        </Text>
        {borrowers.map((b, idx) => (
          <Text
            key={b.id}
            style={
              idx === borrowers.length - 1
                ? [styles.sbsHeaderCell, styles.sbsHeaderCellLast]
                : styles.sbsHeaderCell
            }
          >
            {strings.cover.borrowerN(idx + 1)}
          </Text>
        ))}
      </View>
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

function buildFieldRows(
  borrowers: BankPdfData['borrowers'],
  strings: PdfStrings,
  locale: Locale,
): Row[] {
  const f = strings.cover.fields;
  const dash = strings.values.dash;
  const roleLabel = (role: RoleInCase) => {
    switch (role) {
      case 'guarantor':
        return strings.values.guarantor;
      case 'rights_owner':
        return strings.values.rights_owner;
      case 'mortgaging_borrower':
        return strings.values.mortgaging_borrower;
      default:
        return strings.values.borrower;
    }
  };

  return [
    {
      label: f.roleInCase,
      values: borrowers.map(
        (b) => `${roleLabel(b.role)}${b.isPrimary ? f.primarySuffix : ''}`,
      ),
    },
    { label: f.fullName, values: borrowers.map((b) => b.fullName) },
    { label: f.nationalId, values: borrowers.map((b) => b.nationalId ?? dash) },
    { label: f.idIssueDate, values: borrowers.map((b) => fmtDate(b.idIssueDate, locale, dash)) },
    { label: f.idExpiryDate, values: borrowers.map((b) => fmtDate(b.idExpiryDate, locale, dash)) },
    { label: f.birthDate, values: borrowers.map((b) => fmtDate(b.birthDate, locale, dash)) },
    {
      label: f.age,
      values: borrowers.map((b) => (b.ageYears === null ? dash : String(b.ageYears))),
    },
    {
      label: f.gender,
      values: borrowers.map((b) =>
        b.gender ? (strings.values.gender[b.gender] ?? b.gender) : dash,
      ),
    },
    {
      label: f.maritalStatus,
      values: borrowers.map((b) =>
        b.maritalStatus
          ? (strings.values.maritalStatus[b.maritalStatus] ?? b.maritalStatus)
          : dash,
      ),
    },
    {
      label: f.childrenUnder18,
      values: borrowers.map((b) =>
        b.childrenCount === null ? dash : String(b.childrenCount),
      ),
    },
    { label: f.phone, values: borrowers.map((b) => b.phone ?? dash) },
    { label: f.email, values: borrowers.map((b) => b.email ?? dash) },
    { label: f.address, values: borrowers.map((b) => b.address ?? dash) },
    {
      label: f.citizenship,
      values: borrowers.map((b) => b.citizenship ?? f.defaultCitizenship),
    },
    {
      label: f.residency,
      values: borrowers.map((b) =>
        b.residencyType
          ? (strings.values.residency[b.residencyType] ?? b.residencyType)
          : dash,
      ),
    },
    {
      label: f.avgMonthlyIncomeNet,
      values: borrowers.map((b) => fmtCurrency(b.monthlyIncomeTotal, locale, dash)),
    },
    {
      label: f.primaryIncomeSource,
      values: borrowers.map((b) => {
        const primary = b.incomes[0];
        if (!primary) return dash;
        return [primary.typeName, primary.sourceName].filter(Boolean).join(' · ') || dash;
      }),
    },
    {
      label: f.primaryIncomeTenure,
      values: borrowers.map((b) => {
        const primary = b.incomes[0];
        return primary?.tenureMonths === null || primary?.tenureMonths === undefined
          ? dash
          : fmtNum(primary.tenureMonths, locale, dash);
      }),
    },
  ];
}
