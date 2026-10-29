import type { CalendarItem, CalendarLayer } from '../types';

/** Items grouped by day, each day sorted: all-day first, then by time. */
export function groupByDay(items: ReadonlyArray<CalendarItem>): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = map.get(item.day) ?? [];
    list.push(item);
    map.set(item.day, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.time === null && b.time !== null) return -1;
      if (a.time !== null && b.time === null) return 1;
      return (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'he');
    });
  }
  return map;
}

export type CalendarFilter = {
  layers: ReadonlySet<CalendarLayer>;
  /** Empty = everyone the viewer can see. */
  advisorIds: ReadonlySet<string>;
  /** Free-text match on title / client / case number. */
  query: string;
};

/** Layer toggles + advisor + client search, applied on the client. */
export function filterItems(
  items: ReadonlyArray<CalendarItem>,
  filter: CalendarFilter,
): CalendarItem[] {
  const q = filter.query.trim().toLowerCase();
  const caseNumber = q.replace(/^#/, '');
  return items.filter(
    (item) =>
      filter.layers.has(item.layer) &&
      (filter.advisorIds.size === 0 || item.advisorIds.some((id) => filter.advisorIds.has(id))) &&
      (q === '' ||
        item.title.toLowerCase().includes(q) ||
        (item.caseLabel ?? '').toLowerCase().includes(q) ||
        (caseNumber !== '' && (item.caseNumber ?? '').includes(caseNumber))),
  );
}
