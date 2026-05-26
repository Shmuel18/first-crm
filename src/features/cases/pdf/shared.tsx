import { Text, View } from '@react-pdf/renderer';

import type { PdfStrings } from './strings';
import { styles } from './styles';

/**
 * Small reusable bits used across multiple pages of the bank PDF. Kept here
 * so a single section file doesn't need to redefine them — and the
 * orchestrator stays small.
 */

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function SummaryCell4({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={last ? [styles.summary4Cell, styles.summary4CellLast] : styles.summary4Cell}>
      <Text style={styles.summary4Label}>{label}</Text>
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
