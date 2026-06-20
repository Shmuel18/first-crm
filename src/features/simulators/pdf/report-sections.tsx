import { Text, View } from '@react-pdf/renderer';

import type { Locale } from '@/lib/i18n/direction';

import type { ScenarioReportData } from './report-data.service';
import { fmtAgorot, fmtPct } from './report-formatters';
import type { ReportStrings } from './report-strings';
import { styles } from './report-styles';

type SectionProps = { data: ScenarioReportData; strings: ReportStrings; locale: Locale };

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function LoanSection({ data, strings, locale }: SectionProps) {
  const { loan } = data;
  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.loan.title}</Text>
      <View style={styles.statGrid}>
        <StatCell label={strings.loan.propertyValue} value={fmtAgorot(loan.propertyValue, locale)} />
        <StatCell label={strings.loan.equity} value={fmtAgorot(loan.equity, locale)} />
        <StatCell label={strings.loan.mortgageAmount} value={fmtAgorot(loan.mortgageAmount, locale)} />
        <StatCell label={strings.loan.term} value={strings.loan.months(loan.termMonths)} />
        <StatCell label={strings.loan.ltv} value={fmtPct(data.result.ltv, locale)} />
        <StatCell label={strings.meta.caseNumber} value={data.caseInfo?.caseNumber ?? strings.dash} />
      </View>
    </View>
  );
}

export function TracksSection({ data, strings, locale }: SectionProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.tracks.title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={styles.th}>{strings.tracks.type}</Text>
          <Text style={styles.th}>{strings.tracks.amount}</Text>
          <Text style={styles.th}>{strings.tracks.rate}</Text>
          <Text style={styles.th}>{strings.tracks.term}</Text>
          <Text style={styles.th}>{strings.tracks.repayment}</Text>
          <Text style={[styles.th, styles.thLast]}>{strings.tracks.cpi}</Text>
        </View>
        {data.tracks.map((track, index) => (
          <View key={index} style={styles.tr}>
            <Text style={styles.td}>{strings.tracks.types[track.type]}</Text>
            <Text style={styles.td}>{fmtAgorot(track.amount, locale)}</Text>
            <Text style={styles.td}>{fmtPct(track.annualRatePct, locale)}</Text>
            <Text style={styles.td}>{track.termMonths}</Text>
            <Text style={styles.td}>{strings.tracks.repayments[track.repayment]}</Text>
            <Text style={[styles.td, styles.tdLast]}>
              {track.cpiAnnualPct === null ? strings.dash : fmtPct(track.cpiAnnualPct, locale)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ResultsSection({ data, strings, locale }: SectionProps) {
  const { result } = data;
  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.results.title}</Text>
      <View style={styles.statGrid}>
        <StatCell label={strings.results.firstPayment} value={fmtAgorot(result.firstPayment, locale)} />
        <StatCell label={strings.results.averagePayment} value={fmtAgorot(result.averagePayment, locale)} />
        <StatCell label={strings.results.maxPayment} value={fmtAgorot(result.maxPayment, locale)} />
        <StatCell label={strings.results.totalInterest} value={fmtAgorot(result.totalInterest, locale)} />
        <StatCell label={strings.results.totalIndexation} value={fmtAgorot(result.totalIndexation, locale)} />
        <StatCell label={strings.results.totalCost} value={fmtAgorot(result.totalCost, locale)} />
      </View>
    </View>
  );
}

export function ConclusionSection({ data, strings, locale }: SectionProps) {
  const text = data.meta.advisorConclusion?.trim();
  // Advisor prose ends in Hebrew punctuation (periods) that drifts under the
  // default LTR base; force RTL so sentences read correctly.
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  return (
    <View wrap={false}>
      <Text style={styles.sectionTitle}>{strings.conclusion.title}</Text>
      <View style={styles.conclusionBox}>
        {text ? (
          <Text style={[styles.conclusionText, { direction: dir }]}>{text}</Text>
        ) : (
          <Text style={[styles.conclusionEmpty, { direction: dir }]}>{strings.conclusion.empty}</Text>
        )}
      </View>
    </View>
  );
}
