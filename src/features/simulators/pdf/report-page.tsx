import { Page, Text, View } from '@react-pdf/renderer';

import type { Locale } from '@/lib/i18n/direction';

import { sampleAnnualCurve } from '../domain/curve-sampling';
import { ReportChart } from './chart-svg';
import type { ScenarioReportData } from './report-data.service';
import { fmtDate } from './report-formatters';
import { ConclusionSection, LoanSection, MetaItem, ResultsSection, TracksSection } from './report-sections';
import type { ReportStrings } from './report-strings';
import { COLOR_CHART, COLOR_CHART_ALT, styles } from './report-styles';

type Props = { data: ScenarioReportData; strings: ReportStrings; locale: Locale };

export function ReportPage({ data, strings, locale }: Props) {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <Text style={styles.title}>{data.meta.title}</Text>
          <Text style={styles.subtitle}>{strings.kind[data.meta.kind] ?? strings.kind.mix}</Text>
        </View>
        <View style={styles.brandBlock}>
          <View style={styles.brandBar} />
          <Text style={styles.brandName}>{strings.brandName}</Text>
          <Text style={styles.brandSub}>{strings.brandSub}</Text>
        </View>
      </View>
      <View style={styles.rule} />

      <View style={styles.metaStrip}>
        <MetaItem label={strings.meta.date} value={fmtDate(data.meta.createdAt, locale)} />
        {data.caseInfo ? <MetaItem label={strings.meta.caseNumber} value={data.caseInfo.caseNumber} /> : null}
        {data.caseInfo?.advisorName ? <MetaItem label={strings.meta.advisor} value={data.caseInfo.advisorName} /> : null}
      </View>

      <LoanSection data={data} strings={strings} locale={locale} />
      <TracksSection data={data} strings={strings} locale={locale} />
      <ResultsSection data={data} strings={strings} locale={locale} />

      <Text style={styles.sectionTitle}>{strings.charts.paymentTitle}</Text>
      <ReportChart points={sampleAnnualCurve(data.result.paymentCurve)} color={COLOR_CHART} caption={strings.charts.yearsAxis} />

      <Text style={styles.sectionTitle}>{strings.charts.balanceTitle}</Text>
      <ReportChart points={sampleAnnualCurve(data.result.balanceCurve)} color={COLOR_CHART_ALT} caption={strings.charts.yearsAxis} />

      <ConclusionSection data={data} strings={strings} locale={locale} />

      <Text style={[styles.disclaimer, { direction: dir }]}>{strings.disclaimer}</Text>

      <View style={styles.footer} fixed>
        <Text style={{ direction: dir }}>{strings.footer.brandTagline}</Text>
        <Text render={({ pageNumber, totalPages }) => strings.footer.pageOfN(pageNumber, totalPages)} />
      </View>
    </Page>
  );
}
