'use client';

import { useState } from 'react';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';
import { DayPicker } from 'react-day-picker';
import { he } from 'date-fns/locale/he';
import { enUS } from 'date-fns/locale/en-US';

import { Tooltip } from '@/components/ui/tooltip';

import 'react-day-picker/style.css';

type Props = {
  /** ISO date string (YYYY-MM-DD) or null. */
  value: string | null;
  /** Called when the user picks a date. New value is YYYY-MM-DD or null. */
  onSelect: (next: string | null) => void;
  /** Accessible label for the trigger button. */
  label: string;
  disabled?: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();
const START_MONTH = new Date(CURRENT_YEAR - 80, 0);
const END_MONTH = new Date(CURRENT_YEAR + 5, 11);

/**
 * Branded date picker popover. Replaces the browser's native
 * <input type="date"> picker with a styled DayPicker:
 *   - Year + month dropdowns (range: 80 years back, 5 forward) so
 *     entering birth dates doesn't take 60 clicks on the arrows.
 *   - Fixed-size grid (6 week rows always rendered) so the popup
 *     doesn't jump in height when the user navigates between months.
 *   - Brand-gold selection, hover, today highlight.
 *   - "Today" + "Clear" quick actions at the bottom.
 *   - RTL aware via the direction provider.
 *
 * The host EditableField keeps its text input so the user can still
 * type a date by hand; this component is only the "click the icon to
 * pick visually" affordance.
 */
export function DatePickerPopover({ value, onSelect, label, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const dateLocale = locale === 'he' ? he : enUS;
  const isHebrew = locale === 'he';
  const selected = parseIso(value);

  // Anchor month state — keeps the visible month stable across re-opens
  // and lets the Today / Clear buttons jump the view without depending
  // on `selected` (which might be empty).
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  const handleToday = () => {
    const today = new Date();
    setMonth(today);
    onSelect(formatIso(today));
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <Tooltip content={label}>
        <PopoverPrimitive.Trigger
          render={
            <button
              type="button"
              aria-label={label}
              disabled={disabled}
              className="shrink-0 size-7 rounded inline-flex items-center justify-center text-neutral-500 hover:text-brand-gold-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarIcon aria-hidden="true" className="size-3.5" />
            </button>
          }
        />
      </Tooltip>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={6} align="start" className="z-50 outline-none">
          <PopoverPrimitive.Popup
            // Fixed width keeps the popup from shifting horizontally
            // when month length changes; min-height keeps the grid
            // tall enough for 6 weeks. The user sees a stable card.
            className="w-[20rem] rounded-xl border border-neutral-200 bg-white shadow-lg ring-1 ring-foreground/5 outline-none overflow-hidden"
          >
            <DayPicker
              mode="single"
              selected={selected ?? undefined}
              onSelect={(date) => {
                if (date) {
                  onSelect(formatIso(date));
                  setOpen(false);
                }
              }}
              month={month}
              onMonthChange={setMonth}
              locale={dateLocale}
              dir={isHebrew ? 'rtl' : 'ltr'}
              showOutsideDays
              fixedWeeks
              captionLayout="dropdown"
              startMonth={START_MONTH}
              endMonth={END_MONTH}
              components={{
                // RTL flip: react-day-picker passes `orientation` based on
                // button position (left vs right). In a Hebrew calendar
                // the right-side button is "previous" (the user's reading
                // direction reads right-to-left, so back-in-time points
                // right). Swap the chevron icons so each arrow points
                // the way its click actually travels.
                Chevron: ({ orientation }) =>
                  orientation === 'left' ? (
                    <ChevronRight className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  ),
              }}
              classNames={{
                root: 'p-3 text-sm',
                months: 'flex flex-col',
                month: 'space-y-2',
                month_caption: 'flex items-center justify-center gap-1 py-1',
                caption_label: 'sr-only',
                dropdowns: 'flex items-center gap-1.5',
                dropdown_root: 'relative inline-flex items-center',
                dropdown:
                  'h-8 ps-2 pe-7 rounded-md border border-neutral-200 bg-white text-sm text-neutral-800 font-medium hover:border-brand-gold-text/40 focus-visible:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 appearance-none cursor-pointer transition',
                months_dropdown: 'min-w-[5.5rem]',
                years_dropdown: 'min-w-[4.5rem]',
                nav: 'flex items-center justify-between absolute inset-x-3 top-3 pointer-events-none',
                button_previous:
                  'pointer-events-auto inline-flex items-center justify-center size-7 rounded-md text-neutral-600 hover:bg-brand-gold-soft hover:text-brand-gold-text transition disabled:opacity-40 disabled:hover:bg-transparent',
                button_next:
                  'pointer-events-auto inline-flex items-center justify-center size-7 rounded-md text-neutral-600 hover:bg-brand-gold-soft hover:text-brand-gold-text transition disabled:opacity-40 disabled:hover:bg-transparent',
                weekdays: 'grid grid-cols-7',
                weekday:
                  'text-[11px] font-medium text-neutral-500 size-8 inline-flex items-center justify-center',
                week: 'grid grid-cols-7',
                day: 'p-0',
                day_button:
                  'size-8 inline-flex items-center justify-center rounded-md text-sm text-neutral-800 hover:bg-brand-gold-soft hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition',
                today: '[&_button]:font-bold [&_button]:text-brand-gold-text',
                selected:
                  '[&_button]:bg-brand-gold [&_button]:text-brand-black [&_button]:font-semibold [&_button:hover]:bg-brand-gold-hover [&_button:hover]:text-brand-black',
                outside: '[&_button]:text-neutral-300',
                disabled: '[&_button]:opacity-40 [&_button]:cursor-not-allowed',
              }}
            />

            {/* Footer with Today / Clear quick actions */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-neutral-100 bg-neutral-50/60">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-neutral-600 hover:text-red-600 px-2 py-1 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                {isHebrew ? 'נקה' : 'Clear'}
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="text-xs font-medium text-brand-gold-text hover:text-brand-black px-2 py-1 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
              >
                {isHebrew ? 'היום' : 'Today'}
              </button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Convert ISO YYYY-MM-DD to Date (local time) — null if invalid/empty. */
function parseIso(iso: string | null): Date | null {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Convert Date to ISO YYYY-MM-DD using the local clock — matches what
 *  the user picked on the calendar instead of shifting via UTC. */
function formatIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
