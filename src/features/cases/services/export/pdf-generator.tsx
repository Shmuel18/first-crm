import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import { type ReactElement } from 'react';

import { ensureHebrewFontRegistered } from '@/features/cases/pdf/fonts';

import type { ExportRow } from './build-export-rows';

/**
 * Load the brand mark as a base64 data URL (@react-pdf needs an inline src:
 * it branches on the string prefix, so a Buffer crashes and a Windows path
 * trips its URL heuristics).
 *
 * The file MUST live under a directory listed in `outputFileTracingIncludes`
 * (next.config.ts). Vercel does not trace /public into a serverless function,
 * so an untraced asset ENOENTs in production while working fine locally —
 * that is exactly how this export broke: the header logo was added pointing
 * at /public/logo-coin-square.png, which is served by the CDN but absent from
 * the function's filesystem.
 *
 * public/pdf/logo-coin.png is the same mark downscaled to 240px (15 kB vs the
 * 2.1 MB original) — it renders at 40pt, and the full-size file inflated every
 * exported PDF to ~2.8 MB, uncomfortably close to Vercel's 4.5 MB response cap.
 *
 * Decorative, so it fails SOFT: a missing/unreadable logo must never turn a
 * data export into a 500. Resolved once per lambda instance, failure included.
 */
let logoDataUrl: string | null = null;
let logoResolved = false;
async function loadLogo(): Promise<string | null> {
  if (logoResolved) return logoDataUrl;
  logoResolved = true;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'pdf', 'logo-coin.png');
    const buffer = await readFile(logoPath);
    logoDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('[exports] PDF header logo unavailable, rendering without it', err);
    logoDataUrl = null;
  }
  return logoDataUrl;
}

const COLORS = {
  black: '#0A0A0A',
  gold: '#C9A961',
  border: '#E5E5E5',
  muted: '#888888',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Heebo', fontSize: 9, color: COLORS.black },
  header: {
    // row-reverse so the brand cluster (logo + title) sits on the right,
    // matching the RTL flow of the table below; the generated-at meta
    // lands on the left.
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  // The medallion is already a circular black+gold coin on a transparent
  // square — no backgroundColor / borderRadius needed; it reads as a round
  // brand stamp on the white header.
  logo: { width: 40, height: 40, objectFit: 'contain' },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 14, color: COLORS.black, textAlign: 'right' },
  subtitle: { fontSize: 8, color: COLORS.muted, marginTop: 2, textAlign: 'right' },
  meta: { fontSize: 8, color: COLORS.muted, textAlign: 'left' },
  table: { width: '100%' },
  headerRow: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.black,
    minHeight: 26,
    alignItems: 'center',
  },
  dataRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    minHeight: 20,
    alignItems: 'center',
  },
  headerCell: {
    color: COLORS.white,
    fontSize: 9,
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  cell: {
    fontSize: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    textAlign: 'right',
    color: COLORS.black,
  },
  // Widths sum to 100%. Note: order is right-to-left visually due to row-reverse.
  colRow: { width: '5%' },
  colName: { width: '20%' },
  colId: { width: '11%' },
  colStage: { width: '17%' },
  colBank: { width: '13%' },
  colAdvisor: { width: '14%' },
  colNote: { width: '20%' },
  footer: {
    position: 'absolute',
    bottom: 18,
    right: 32,
    left: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: COLORS.muted,
  },
});

export type PdfHeaders = {
  title: string;
  subtitle: string;
  generatedAt: string;
  row: string;
  clientName: string;
  nationalId: string;
  stage: string;
  bank: string;
  advisor: string;
  shortNote: string;
};

function CasesDocument({
  rows,
  h,
  logoSrc,
}: {
  rows: ReadonlyArray<ExportRow>;
  h: PdfHeaders;
  logoSrc: string | null;
}): ReactElement {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            {logoSrc && (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt
              <Image src={logoSrc} style={styles.logo} />
            )}
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{h.title}</Text>
              <Text style={styles.subtitle}>{h.subtitle}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{h.generatedAt}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            <Text style={[styles.headerCell, styles.colRow]}>{h.row}</Text>
            <Text style={[styles.headerCell, styles.colName]}>{h.clientName}</Text>
            <Text style={[styles.headerCell, styles.colId]}>{h.nationalId}</Text>
            <Text style={[styles.headerCell, styles.colStage]}>{h.stage}</Text>
            <Text style={[styles.headerCell, styles.colBank]}>{h.bank}</Text>
            <Text style={[styles.headerCell, styles.colAdvisor]}>{h.advisor}</Text>
            <Text style={[styles.headerCell, styles.colNote]}>{h.shortNote}</Text>
          </View>

          {rows.map((row) => (
            <View key={row.rowNumber} style={styles.dataRow} wrap={false}>
              <Text style={[styles.cell, styles.colRow]}>{row.rowNumber}</Text>
              <Text style={[styles.cell, styles.colName]}>{row.clientName}</Text>
              <Text style={[styles.cell, styles.colId]}>{row.nationalId}</Text>
              <Text style={[styles.cell, styles.colStage]}>{row.stage}</Text>
              <Text style={[styles.cell, styles.colBank]}>{row.bank}</Text>
              <Text style={[styles.cell, styles.colAdvisor]}>{row.advisor}</Text>
              <Text style={[styles.cell, styles.colNote]}>{row.shortNote}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>{h.title}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateCasesPdf(
  rows: ReadonlyArray<ExportRow>,
  headers: PdfHeaders,
): Promise<Buffer> {
  ensureHebrewFontRegistered();
  const logoSrc = await loadLogo();
  return await renderToBuffer(<CasesDocument rows={rows} h={headers} logoSrc={logoSrc} />);
}
