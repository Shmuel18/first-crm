import { Text, View } from '@react-pdf/renderer';

import type { Locale } from '@/lib/i18n/direction';

import type { PdfStrings } from './strings';
import { styles } from './styles';

/**
 * Small reusable bits used across multiple pages of the bank PDF. Kept here
 * so a single section file doesn't need to redefine them — and the
 * orchestrator stays small.
 */

/**
 * Base direction for a *label* (always prose in the document's language).
 *
 * react-pdf defaults every Text to LTR and does NOT inherit direction from its
 * parent View, so a Hebrew label without this renders on an LTR base. Pure
 * Hebrew survives that, but anything the label carries alongside the words —
 * a parenthesised acronym, a trailing colon — lands on the wrong end of the
 * line. Measured: "אחוז מימון (LTV)" printed "(LTV)" on the right instead of
 * the left.
 *
 * ⚠️ ONLY safe on a Text with a definite width (a flex cell, a full-width
 * column). `direction` also feeds Yoga's layout direction, and on a
 * shrink-to-fit Text it collapses the node — the text then renders as NOTHING,
 * silently. Verified by extracting glyph positions from the PDF: the label
 * simply vanished from the output. If a label auto-sizes (e.g. inside a
 * `row-reverse` row), order sibling Texts instead — see MetaItem.
 *
 * Deliberately NOT applied to VALUES: those are data, often pure LTR
 * (`KFG-2026-014`, `15.1.2026`, `70.0%`), and forcing RTL on them would drag
 * their punctuation to the wrong side — the mirror image of the bug above.
 */
export const labelDir = (locale: Locale): { direction: 'rtl' | 'ltr' } => ({
  direction: locale === 'he' ? 'rtl' : 'ltr',
});

export function MetaItem({
  label,
  value,
  locale,
}: {
  label: string;
  value: string;
  locale: Locale;
}) {
  return (
    <View style={styles.metaItem}>
      {/* The label auto-sizes inside this row-reverse row, so `direction` can't
          be used here (it would collapse the node — see labelDir). Instead the
          colon is its own Text and the row-reverse flex places it to the LEFT
          of the Hebrew label, which is where a trailing colon belongs in RTL.
          English keeps the colon inside the label string: that document is LTR
          prose and needs no reordering. */}
      {locale === 'he' ? (
        // Nested row-reverse with NO gap: the parent's gap:4 would otherwise
        // leave the colon floating a space off its word ("מספר תיק : KFG").
        <View style={styles.metaLabelGroup}>
          <Text style={styles.metaLabel}>{label}</Text>
          <Text style={styles.metaLabel}>:</Text>
        </View>
      ) : (
        <Text style={styles.metaLabel}>{`${label}:`}</Text>
      )}
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function SummaryCell4({
  label,
  value,
  locale,
  last,
}: {
  label: string;
  value: string;
  locale: Locale;
  last?: boolean;
}) {
  return (
    <View style={last ? [styles.summary4Cell, styles.summary4CellLast] : styles.summary4Cell}>
      <Text style={[styles.summary4Label, labelDir(locale)]}>{label}</Text>
      <Text style={styles.summary4Value}>{value}</Text>
    </View>
  );
}

/**
 * Fixed page footer with branding on the right (RTL) and page-of-N on the
 * left. Render once per <Page> with the `fixed` prop — react-pdf paints it
 * on every page even if content overflows.
 */
export function PageFooter({ strings }: { strings: PdfStrings }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{strings.footer.brandTagline}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          strings.footer.pageOfN(pageNumber, totalPages)
        }
      />
    </View>
  );
}
