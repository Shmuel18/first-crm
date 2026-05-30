'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import type { SortColumn, SortDir } from '../domain/case-sort';

/**
 * Plain non-sortable header cell. Stays separate from <SortableTh> so the
 * sort-related ARIA + interaction state doesn't leak onto columns that
 * don't sort (row index, national_id, bank, advisor, short note).
 */
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-start text-xs font-semibold text-neutral-600 uppercase tracking-wider px-4 py-3"
    >
      {children}
    </th>
  );
}

type SortableThProps = {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; dir: SortDir } | null;
  onSort: (column: SortColumn) => void;
  /** Optional help text shown on hover/focus of the header. */
  tooltip?: string;
};

/**
 * Header cell with a 3-state sort cycle (asc → desc → cleared). Surfaces
 * the active direction through aria-sort + a directional arrow icon so
 * screen readers and sighted users see the same state.
 */
export function SortableTh({ label, column, sort, onSort, tooltip }: SortableThProps) {
  const isActive = sort?.column === column;
  const ariaSort = isActive ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const ArrowIcon = !isActive ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th scope="col" aria-sort={ariaSort} className="p-0">
      {/* Native title for the column-help text: reliable in a sortable <th>
          (the base-ui Tooltip wouldn't open when wrapping this sort button). */}
      <button
        type="button"
        onClick={() => onSort(column)}
        title={tooltip}
        className={[
          'group flex w-full items-center gap-1 px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold-text/40',
          isActive
            ? 'text-neutral-900'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
        ].join(' ')}
      >
        {label}
        <ArrowIcon
          aria-hidden="true"
          className={[
            'size-3 shrink-0 transition-opacity',
            isActive
              ? 'text-brand-gold-text opacity-100'
              : 'text-neutral-400 opacity-40 group-hover:opacity-100',
          ].join(' ')}
        />
      </button>
    </th>
  );
}
