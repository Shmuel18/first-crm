import { StyleSheet } from '@react-pdf/renderer';

/**
 * Brand colours + shared StyleSheet for the bank-submission PDF.
 *
 * All RTL layouts use `flexDirection: 'row-reverse'` — react-pdf doesn't
 * cascade `direction: rtl`, so each row that needs Hebrew reading order
 * must opt in explicitly. textAlign defaults to 'right' on text inside
 * those rows.
 */

export const COLOR_TEXT = '#0A0A0A';
export const COLOR_MUTED = '#525252';
export const COLOR_LINE = '#E5E5E5';
export const COLOR_LINE_DARK = '#D4D4D4';
export const COLOR_BRAND = '#C9A961';
export const COLOR_BRAND_DARK = '#A88840';
export const COLOR_SECTION_BG = '#FAF8F3';
export const COLOR_HIGHLIGHT_BG = '#FFF8E7';
export const COLOR_HEADER_BG = '#525252';

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 9,
    color: COLOR_TEXT,
    padding: 36,
    paddingBottom: 64,
  },

  // ─────────── Cover header ───────────
  cover: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
  },
  coverRight: { flexDirection: 'column', alignItems: 'flex-end', maxWidth: '70%' },
  coverTitle: { fontSize: 18, fontWeight: 600, color: COLOR_TEXT, textAlign: 'right' },
  coverSubtitle: {
    fontSize: 10,
    color: COLOR_TEXT,
    marginTop: 6,
    fontWeight: 600,
    textAlign: 'right',
  },
  coverDate: { fontSize: 8, color: COLOR_MUTED, marginTop: 4, textAlign: 'right' },
  brandBlock: { flexDirection: 'column', alignItems: 'flex-start' },
  brandBar: { width: 60, height: 4, backgroundColor: COLOR_BRAND, marginBottom: 6 },
  brandName: { fontSize: 13, fontWeight: 600, color: COLOR_BRAND_DARK },
  brandSub: { fontSize: 8, color: COLOR_MUTED, marginTop: 1 },
  coverRule: { borderBottom: `2 solid ${COLOR_BRAND}`, marginBottom: 12 },

  // ─────────── Meta strip ───────────
  metaStrip: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    backgroundColor: COLOR_SECTION_BG,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 14,
    gap: 16,
  },
  metaItem: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 },
  metaLabel: { fontSize: 8, color: COLOR_MUTED },
  metaValue: { fontSize: 9, color: COLOR_TEXT, fontWeight: 600 },

  // ─────────── Section heading ───────────
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: COLOR_HEADER_BG,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'right',
    marginTop: 10,
    marginBottom: 0,
  },

  // ─────────── Side-by-side borrower table ───────────
  sbsTable: {
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
    borderRight: `1 solid ${COLOR_LINE_DARK}`,
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
  },
  sbsHeader: { flexDirection: 'row-reverse', backgroundColor: '#F5F5F5' },
  sbsHeaderCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `1 solid ${COLOR_LINE_DARK}`,
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
    fontSize: 9,
    fontWeight: 600,
    color: COLOR_TEXT,
    textAlign: 'right',
  },
  sbsHeaderCellLast: { borderLeft: 'none' },
  sbsRow: { flexDirection: 'row-reverse' },
  sbsCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: `1 solid ${COLOR_LINE}`,
    borderLeft: `1 solid ${COLOR_LINE}`,
    fontSize: 8.5,
    color: COLOR_TEXT,
    textAlign: 'right',
  },
  sbsCellLast: { borderLeft: 'none' },
  sbsLabelCell: {
    fontSize: 8.5,
    color: COLOR_MUTED,
    backgroundColor: '#FAFAFA',
  },

  // ─────────── Combined obligations table ───────────
  table: {
    marginTop: 6,
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
    borderRight: `1 solid ${COLOR_LINE_DARK}`,
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
  },
  tableHead: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F5F5F5',
    borderBottom: `1 solid ${COLOR_LINE_DARK}`,
  },
  th: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    fontWeight: 600,
    color: COLOR_TEXT,
    textAlign: 'right',
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
  },
  thLast: { borderLeft: 'none' },
  tr: {
    flexDirection: 'row-reverse',
    borderBottom: `0.5 solid ${COLOR_LINE}`,
  },
  td: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8.5,
    color: COLOR_TEXT,
    textAlign: 'right',
    borderLeft: `0.5 solid ${COLOR_LINE}`,
  },
  tdLast: { borderLeft: 'none' },
  totalRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FAFAFA',
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
  },
  totalCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: 600,
    color: COLOR_BRAND_DARK,
    textAlign: 'right',
    borderLeft: `0.5 solid ${COLOR_LINE_DARK}`,
  },
  longTermBadge: { fontSize: 7, color: COLOR_BRAND_DARK, marginLeft: 4 },
  emptyObligationsBox: {
    padding: 12,
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
    borderBottom: `1 solid ${COLOR_LINE_DARK}`,
    borderRight: `1 solid ${COLOR_LINE_DARK}`,
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
  },
  obligationsFootnote: {
    flexDirection: 'row-reverse',
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#FAFAFA',
    borderTop: `0.5 solid ${COLOR_LINE_DARK}`,
  },

  // ─────────── Summary grids ───────────
  summary4: {
    flexDirection: 'row-reverse',
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
    borderBottom: `1 solid ${COLOR_LINE_DARK}`,
    backgroundColor: '#FAFAFA',
  },
  summary4Cell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
    alignItems: 'flex-end',
  },
  summary4CellLast: { borderLeft: 'none' },
  summary4Label: { fontSize: 8, color: COLOR_MUTED, textAlign: 'right' },
  summary4Value: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR_TEXT,
    marginTop: 3,
    textAlign: 'right',
  },

  // ─────────── Available-income highlight ───────────
  availableBox: {
    flexDirection: 'row-reverse',
    backgroundColor: COLOR_HIGHLIGHT_BG,
    border: `1 solid ${COLOR_BRAND}`,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 14,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availableLabel: { fontSize: 11, color: COLOR_TEXT, fontWeight: 600 },
  availableValue: { fontSize: 16, color: COLOR_BRAND_DARK, fontWeight: 600 },

  // ─────────── DTI bands ───────────
  bandsTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: COLOR_TEXT,
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'right',
  },
  bandsGrid: {
    flexDirection: 'row-reverse',
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
    borderBottom: `1 solid ${COLOR_LINE_DARK}`,
  },
  bandCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
  },
  bandCellLast: { borderLeft: 'none' },
  bandRatio: { fontSize: 9, color: COLOR_MUTED },
  bandPayment: { fontSize: 14, fontWeight: 600, color: COLOR_TEXT, marginTop: 3 },

  // ─────────── Notes placeholder ───────────
  notesBox: {
    borderTop: `1 solid ${COLOR_LINE_DARK}`,
    borderBottom: `1 solid ${COLOR_LINE_DARK}`,
    borderRight: `1 solid ${COLOR_LINE_DARK}`,
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
  },

  // ─────────── Signature ───────────
  signatureBlock: { marginTop: 28, alignItems: 'flex-start' },
  signatureLine: { width: 240, borderBottom: `1 solid ${COLOR_TEXT}`, height: 28 },
  signatureName: {
    fontSize: 9,
    color: COLOR_TEXT,
    fontWeight: 600,
    marginTop: 4,
    textAlign: 'left',
    width: 240,
  },
  signatureMeta: { fontSize: 8, color: COLOR_MUTED, textAlign: 'left', width: 240 },
  thanksLine: { fontSize: 9, color: COLOR_TEXT, marginTop: 16, textAlign: 'left' },

  // ─────────── Footer ───────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: COLOR_MUTED,
    paddingTop: 6,
    borderTop: `0.5 solid ${COLOR_LINE}`,
  },
});
