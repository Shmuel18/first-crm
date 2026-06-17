import { StyleSheet } from '@react-pdf/renderer';

/**
 * Brand colours + shared StyleSheet for the client simulation report PDF.
 * Raw hex is correct here — this is a react-pdf StyleSheet (JS object), not a
 * Tailwind class, so the no-bracketed-hex rule does not apply. Colours mirror
 * the bank PDF (../../cases/pdf/styles.ts) for one consistent brand look.
 *
 * Layout is RTL (flexDirection 'row-reverse', textAlign 'right') like the bank
 * PDF — react-pdf does not cascade `direction: rtl`, so each row opts in.
 */
export const COLOR_TEXT = '#0A0A0A';
export const COLOR_MUTED = '#525252';
export const COLOR_LINE = '#E5E5E5';
export const COLOR_LINE_DARK = '#D4D4D4';
export const COLOR_BRAND = '#C9A961';
export const COLOR_BRAND_DARK = '#A88840';
export const COLOR_SECTION_BG = '#FAF8F3';
export const COLOR_HEADER_BG = '#525252';
export const COLOR_CHART = '#A88840';
export const COLOR_CHART_ALT = '#2563EB';

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 9,
    color: COLOR_TEXT,
    padding: 36,
    paddingBottom: 64,
  },

  // ─────────── Header ───────────
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
  },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end', maxWidth: '70%' },
  title: { fontSize: 18, fontWeight: 600, color: COLOR_TEXT, textAlign: 'right' },
  subtitle: { fontSize: 10, color: COLOR_MUTED, marginTop: 4, textAlign: 'right' },
  brandBlock: { flexDirection: 'column', alignItems: 'flex-start' },
  brandBar: { width: 60, height: 4, backgroundColor: COLOR_BRAND, marginBottom: 6 },
  brandName: { fontSize: 13, fontWeight: 600, color: COLOR_BRAND_DARK },
  brandSub: { fontSize: 8, color: COLOR_MUTED, marginTop: 1 },
  rule: { borderBottom: `2 solid ${COLOR_BRAND}`, marginBottom: 12 },

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
    marginTop: 12,
    marginBottom: 6,
  },

  // ─────────── Stat grid (loan + results) ───────────
  statGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  statCell: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: '#FAFAFA',
    border: `0.5 solid ${COLOR_LINE_DARK}`,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  statLabel: { fontSize: 8, color: COLOR_MUTED, textAlign: 'right' },
  statValue: { fontSize: 13, fontWeight: 600, color: COLOR_TEXT, marginTop: 3, textAlign: 'right' },

  // ─────────── Tracks table ───────────
  table: {
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
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    fontWeight: 600,
    color: COLOR_TEXT,
    textAlign: 'right',
    borderLeft: `1 solid ${COLOR_LINE_DARK}`,
  },
  thLast: { borderLeft: 'none' },
  tr: { flexDirection: 'row-reverse', borderBottom: `0.5 solid ${COLOR_LINE}` },
  td: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8.5,
    color: COLOR_TEXT,
    textAlign: 'right',
    borderLeft: `0.5 solid ${COLOR_LINE}`,
  },
  tdLast: { borderLeft: 'none' },

  // ─────────── Chart block ───────────
  chartBlock: { marginTop: 4 },
  chartCaption: { fontSize: 8, color: COLOR_MUTED, textAlign: 'center', marginTop: 2 },
  axisRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 2 },
  axisLabel: { fontSize: 7, color: COLOR_MUTED },

  // ─────────── Conclusion ───────────
  conclusionBox: {
    border: `1 solid ${COLOR_LINE_DARK}`,
    backgroundColor: '#FFFFFF',
    padding: 10,
    minHeight: 48,
  },
  conclusionText: { fontSize: 9.5, color: COLOR_TEXT, textAlign: 'right', lineHeight: 1.5 },
  // No italic: only the upright Heebo is registered (fonts.ts), and react-pdf
  // throws "Could not resolve font … fontStyle italic" rather than faux-slanting.
  // The muted grey already marks this as the empty-state placeholder.
  conclusionEmpty: { fontSize: 9, color: COLOR_MUTED, textAlign: 'right' },

  // ─────────── Disclaimer ───────────
  disclaimer: {
    marginTop: 14,
    fontSize: 7.5,
    color: COLOR_MUTED,
    textAlign: 'right',
    lineHeight: 1.4,
  },

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
