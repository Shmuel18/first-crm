'use client';

import { ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { ReactNode } from 'react';

export type MultiSelectOption = { id: string; name: string };

type Props = {
  /** Translated filter name — the chip's resting label. */
  label: string;
  /** Ticked option ids. Empty = filter off ("all"). */
  values: ReadonlyArray<string>;
  onChange: (next: string[]) => void;
  options: ReadonlyArray<MultiSelectOption>;
  /** Translated label of the "clear this filter" row (e.g. "הכל"). */
  allLabel: string;
  align?: 'start' | 'end';
  /** Optional leading icon inside the chip. */
  icon?: ReactNode;
};

export function chipClass(active: boolean): string {
  return [
    'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40',
    active
      ? 'border-brand-gold-text bg-brand-gold-soft text-brand-black font-medium'
      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
  ].join(' ');
}

/**
 * A filter chip whose dropdown ticks SEVERAL values at once — the selected
 * values are OR'd by the caller's filter (Kaufman: "let me tick everything
 * except 'in review' and 'done'"). The menu deliberately stays open while
 * ticking (base-ui checkbox items don't close on click), so a multi-value
 * selection is one visit rather than one visit per value.
 *
 * Dumb by design: it owns no filter state and does no filtering — the caller
 * holds the values (URL state via nuqs) and applies them.
 */
export function MultiSelectFilter({
  label,
  values,
  onChange,
  options,
  allLabel,
  align = 'start',
  icon,
}: Props) {
  const active = values.length > 0;
  // Names of the ticked ids, in the option list's own order. An id with no
  // matching option (a stale bookmark, an option hidden in this view) still
  // counts as active — it is still filtering the list.
  const names = options.filter((o) => values.includes(o.id)).map((o) => o.name);
  // One tick reads as the value itself; several as "<filter> · n", because the
  // joined names would overflow the chip row on a phone.
  const triggerText = !active
    ? label
    : values.length === 1
      ? (names[0] ?? label)
      : `${label} · ${values.length}`;
  const accessibleName = names.length > 0 ? `${label}: ${names.join(', ')}` : label;

  const toggle = (id: string, checked: boolean): void => {
    onChange(checked ? [...values, id] : values.filter((v) => v !== id));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={accessibleName}
            aria-pressed={active}
            className={chipClass(active)}
          >
            {icon}
            <span>{triggerText}</span>
            <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
          </button>
        }
      />
      <DropdownMenuContent align={align} className="max-h-72 min-w-44 overflow-y-auto">
        <DropdownMenuCheckboxItem checked={!active} onCheckedChange={() => onChange([])}>
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.id}
            checked={values.includes(o.id)}
            onCheckedChange={(checked) => toggle(o.id, checked)}
          >
            {o.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
