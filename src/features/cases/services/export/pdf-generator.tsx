import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import { type ReactElement } from 'react';

import type { ExportRow } from './build-export-rows';

/**
 * Register the font lazily as a base64 data URL. @react-pdf/renderer's
 * `src` accepts a URL string and parses `data:` URLs by calling
 * `.substring()` on them - passing a Node Buffer (which TypeScript can be
 * cast past) crashes at runtime with "dataUrl.substring is not a function".
 *
 * data: URLs work in every environment - locally and on Vercel Serverless
 * where `process.cwd()` isn't necessarily the repo root. The font (~80kB
 * Heebo) is read once per lambda instance.
 */
let fontRegistered = false;
async function ensureFontRegistered(): Promise<void> {
  if (fontRegistered) return;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'heebo-regular.ttf');
  const buffer = await readFile(fontPath);
  const dataUrl = `data:font/ttf;base64,${buffer.toString('base64')}`;
  Font.register({ family: 'Heebo', src: dataUrl });
  fontRegistered = true;
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  title: { fontSize: 14, color: COLORS.black },
  subtitle: { fontSize: 8, color: COLORS.muted, marginTop: 2 },
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
}: {
  rows: ReadonlyArray<ExportRow>;
  h: PdfHeaders;
}): ReactElement {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>{h.title}</Text>
            <Text style={styles.subtitle}>{h.subtitle}</Text>
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
  await ensureFontRegistered();
  return await renderToBuffer(<CasesDocument rows={rows} h={headers} />);
}
