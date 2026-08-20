import { Text } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';

import { MetaItem, SummaryCell4, labelDir } from './shared';

/**
 * Guards the two RTL rules that are easy to "fix" back into bugs. Both were
 * found by extracting glyph positions from a rendered PDF (see
 * scripts/audit-pdf-rtl.cjs) and both fail silently in production — the text
 * either lands on the wrong side or disappears entirely — so a hermetic test
 * is the only thing that will catch a regression in review.
 */

type Element = { type?: unknown; props?: Record<string, unknown> };

const isElement = (v: unknown): v is Element =>
  typeof v === 'object' && v !== null && 'props' in v;

/** Every <Text> element in a returned tree, in document order. */
function textNodes(node: unknown, out: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const c of node) textNodes(c, out);
    return out;
  }
  if (!isElement(node)) return out;
  if (node.type === Text) out.push(node);
  textNodes(node.props?.children, out);
  return out;
}

const childText = (el: Element): string => {
  const c = el.props?.children;
  return Array.isArray(c) ? c.join('') : String(c ?? '');
};

/** Flattened style entries of an element (style may be an object or an array). */
const styles = (el: Element): Record<string, unknown>[] => {
  const s = el.props?.style;
  const list = Array.isArray(s) ? s : [s];
  return list.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
};

const directionOf = (el: Element): unknown =>
  styles(el).reduce<unknown>((acc, s) => ('direction' in s ? s.direction : acc), undefined);

describe('labelDir', () => {
  it('maps locale to base direction', () => {
    expect(labelDir('he')).toEqual({ direction: 'rtl' });
    expect(labelDir('en')).toEqual({ direction: 'ltr' });
  });
});

describe('MetaItem', () => {
  it('keeps the Hebrew label and its colon as separate Texts', () => {
    // The row is row-reverse, so a colon of its own lands to the LEFT of the
    // label — where a trailing colon belongs in RTL. Merging them back into
    // "`${label}:`" puts the colon on the right, which is the original bug.
    const texts = textNodes(MetaItem({ label: 'מספר תיק', value: 'KFG-2026-014', locale: 'he' }));
    expect(texts.map(childText)).toEqual(['מספר תיק', ':', 'KFG-2026-014']);
  });

  it('never sets direction on its Texts', () => {
    // These labels auto-size inside a row-reverse row, and `direction` also
    // drives Yoga layout: on a shrink-to-fit Text it collapses the node and the
    // label renders as NOTHING. Measured — the whole meta line vanished.
    for (const locale of ['he', 'en'] as const) {
      const texts = textNodes(MetaItem({ label: 'מספר תיק', value: 'KFG', locale }));
      for (const t of texts) expect(directionOf(t)).toBeUndefined();
    }
  });

  it('leaves the colon inside the label string for English', () => {
    const texts = textNodes(MetaItem({ label: 'Case number', value: 'KFG', locale: 'en' }));
    expect(texts.map(childText)).toEqual(['Case number:', 'KFG']);
  });
});

describe('SummaryCell4', () => {
  it('gives the label an explicit base direction', () => {
    // This label DOES have a definite width (a flex cell), so direction is safe
    // here — and necessary: without it "אחוז מימון (LTV)" printed "(LTV)" on the
    // wrong end of the line.
    const he = textNodes(SummaryCell4({ label: 'אחוז מימון (LTV)', value: '70.0%', locale: 'he' }));
    expect(directionOf(he[0]!)).toBe('rtl');
    const en = textNodes(SummaryCell4({ label: 'LTV', value: '70.0%', locale: 'en' }));
    expect(directionOf(en[0]!)).toBe('ltr');
  });

  it('leaves the VALUE direction alone', () => {
    // Values are data and often pure LTR ("70.0%", "15.1.2026"); forcing RTL
    // would drag their punctuation to the wrong side.
    const cells = textNodes(SummaryCell4({ label: 'אחוז מימון (LTV)', value: '70.0%', locale: 'he' }));
    expect(directionOf(cells[1]!)).toBeUndefined();
  });
});
