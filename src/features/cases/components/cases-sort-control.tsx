'use client';

import { ArrowDown, ArrowDownUp, ArrowUp, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { SORT_COLUMNS, type SortColumn, type SortDir } from '../domain/case-sort';

const SORT_DIRS: SortDir[] = ['asc', 'desc'];
const FIELDS: SortColumn[] = ['name', 'stage', 'targetDate'];

/**
 * Mobile sort control for the cases card list — the small-screen equivalent of
 * the desktop table's sortable column headers (which don't exist on cards).
 * Writes the same `sort`/`dir` URL params (shallow), so the card list re-sorts
 * client-side instantly and the desktop table's localStorage persistence stays
 * in sync. Only rendered inside the mobile (xl:hidden) block.
 */
export function CasesSortControl() {
  const t = useTranslations('dashboard');
  const [sortCol, setSortCol] = useQueryState(
    'sort',
    parseAsStringEnum([...SORT_COLUMNS]).withOptions({ shallow: true }),
  );
  const [sortDir, setSortDir] = useQueryState(
    'dir',
    parseAsStringEnum(SORT_DIRS).withOptions({ shallow: true }),
  );

  const labelFor = (c: SortColumn): string =>
    c === 'name'
      ? t('columns.clientName')
      : c === 'stage'
        ? t('columns.stage')
        : t('columns.targetDate');

  const current = sortCol ? `${sortCol}:${sortDir ?? 'asc'}` : '';

  const onValue = (value: string): void => {
    if (!value) {
      setSortCol(null);
      setSortDir(null);
      return;
    }
    const [col, dir] = value.split(':');
    if ((SORT_COLUMNS as readonly string[]).includes(col ?? '')) {
      setSortCol(col as SortColumn);
      setSortDir(dir === 'desc' ? 'desc' : 'asc');
    }
  };

  // Label text only — the direction is shown as a Lucide icon (not a Unicode
  // glyph) for icon-consistency, and announced as words in the aria-label.
  const triggerText = sortCol ? labelFor(sortCol) : t('sort.default');
  const dirWord = sortCol ? (sortDir === 'desc' ? t('sort.desc') : t('sort.asc')) : '';
  const ariaLabel = `${t('sort.label')}: ${triggerText}${dirWord ? ` ${dirWord}` : ''}`;

  return (
    <div className="flex items-center gap-2 bg-white px-4 py-2 border-b border-neutral-200">
      <span className="shrink-0 text-xs text-neutral-400">{t('sort.label')}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={ariaLabel}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              <ArrowDownUp className="size-3.5 text-neutral-500" aria-hidden="true" />
              <span>{triggerText}</span>
              {sortCol &&
                (sortDir === 'desc' ? (
                  <ArrowDown className="size-3 text-neutral-500" aria-hidden="true" />
                ) : (
                  <ArrowUp className="size-3 text-neutral-500" aria-hidden="true" />
                ))}
              <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuRadioGroup value={current} onValueChange={onValue}>
            <DropdownMenuRadioItem value="">{t('sort.default')}</DropdownMenuRadioItem>
            {FIELDS.flatMap((c) =>
              SORT_DIRS.map((d) => (
                <DropdownMenuRadioItem key={`${c}:${d}`} value={`${c}:${d}`}>
                  <span className="inline-flex items-center gap-1.5">
                    {d === 'desc' ? (
                      <ArrowDown className="size-3.5 text-neutral-500" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="size-3.5 text-neutral-500" aria-hidden="true" />
                    )}
                    {labelFor(c)}
                    <span className="sr-only">{d === 'desc' ? t('sort.desc') : t('sort.asc')}</span>
                  </span>
                </DropdownMenuRadioItem>
              )),
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
