import { Page, Text, View } from '@react-pdf/renderer';

import { fmtPct } from '@/features/simulators/pdf/report-formatters';
import { getReportStrings } from '@/features/simulators/pdf/report-strings';
import type { Locale } from '@/lib/i18n/direction';

import type { BankPdfMix } from './bank-pdf-data.service';
import { fmtCurrency, fmtNum } from './formatters';
import { PageFooter } from './shared';
import type { PdfStrings } from './strings';
import { styles } from './styles';

/**
 * One page that lists every proposed mortgage mix, each as a compact block —
 * mix name + a black headline band (first / min / max / average monthly payment,
 * mirroring the on-screen KpiStrip) + the track table. Blocks flow on the page
 * (react-pdf breaks to a new page only when full), and each block is kept whole
 * (`wrap={false}`), so several mixes share a page instead of one page each. The
 * detailed cost breakdown is deliberately omitted — the bank runs its own.
 * Track-type / repayment labels are reused from the simulator report strings.
 */
export function MixesPage({
  mixes,
  strings,
  locale,
}: {
  mixes: BankPdfMix[];
  strings: PdfStrings;
  locale: Locale;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>{strings.mix.title}</Text>
      {mixes.map((mix, idx) => (
        <MixBlock key={idx} mix={mix} strings={strings} locale={locale} />
      ))}
      <PageFooter strings={strings} />
    </Page>
  );
}

function MixBlock({ mix, strings, locale }: { mix: BankPdfMix; strings: PdfStrings; locale: Locale }) {
  const dash = strings.values.dash;
  const r = getReportStrings(locale);

  return (
    <View style={styles.mixBlock} wrap={false}>
      <Text style={styles.mixName}>{mix.title}</Text>

      {/* Black headline band */}
      <View style={styles.mixBand}>
        <KpiTile label={strings.mix.firstPayment} value={fmtCurrency(mix.firstPayment, locale, dash)} hero />
        <KpiTile label={strings.mix.minPayment} value={fmtCurrency(mix.minPayment, locale, dash)} />
        <KpiTile label={strings.mix.maxPayment} value={fmtCurrency(mix.maxPayment, locale, dash)} />
        <KpiTile label={strings.mix.averagePayment} value={fmtCurrency(mix.averagePayment, locale, dash)} />
      </View>

      {/* Track table */}
      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 1.6 }]}>{r.tracks.type}</Text>
          <Text style={[styles.th, { flex: 1.3 }]}>{r.tracks.amount}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{r.tracks.rate}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{r.tracks.term}</Text>
          <Text style={[styles.th, { flex: 1.3 }]}>{r.tracks.repayment}</Text>
          <Text style={[styles.th, styles.thLast, { flex: 1 }]}>{r.tracks.cpi}</Text>
        </View>
        {mix.tracks.map((track, idx) => (
          <View key={idx} style={styles.tr}>
            <Text style={[styles.td, { flex: 1.6 }]}>{r.tracks.types[track.type]}</Text>
            <Text style={[styles.td, { flex: 1.3 }]}>{fmtCurrency(track.amount, locale, dash)}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{fmtPct(track.annualRatePct, locale)}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{fmtNum(track.termMonths, locale, dash)}</Text>
            <Text style={[styles.td, { flex: 1.3 }]}>{r.tracks.repayments[track.repayment]}</Text>
            <Text style={[styles.td, styles.tdLast, { flex: 1 }]}>
              {track.cpiAnnualPct === null ? dash : fmtPct(track.cpiAnnualPct, locale)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function KpiTile({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <View style={hero ? [styles.mixTile, styles.mixTileHero] : styles.mixTile}>
      <Text style={styles.mixTileLabel}>{label}</Text>
      <Text style={hero ? styles.mixTileValueHero : styles.mixTileValue}>{value}</Text>
    </View>
  );
}
