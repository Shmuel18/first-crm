// Integer / count formatter for the statistics KPIs (case counts, advisor
// tallies). Money values use the shared locale-aware formatter in
// src/lib/utils/format-currency.ts (consolidated by L10N-1) — not here.
const intFormatter = new Intl.NumberFormat('he-IL');

export function formatInt(value: number): string {
  return intFormatter.format(value);
}
