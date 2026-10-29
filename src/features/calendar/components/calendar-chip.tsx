'use client';

import { ArrowDownLeft, ArrowUpLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CalendarItem, CalendarLayer } from '../types';

/** One colour per layer (Tailwind tokens, no hex) — the legend uses the same map. */
export const LAYER_STYLE: Record<CalendarLayer, string> = {
  stage: 'border-sky-200 bg-sky-50 text-sky-900',
  targetDate: 'border-brand-gold/40 bg-brand-gold-soft text-brand-gold-text',
  task: 'border-violet-200 bg-violet-50 text-violet-900',
  event: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  expiry: 'border-orange-200 bg-orange-50 text-orange-900',
  agreement: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  opened: 'border-neutral-200 bg-neutral-50 text-neutral-700',
};

const OVERDUE_STYLE = 'border-red-200 bg-red-50 text-red-800';

type Props = {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  /** Compact = month cells (one line); full = agenda / day lists. */
  compact?: boolean;
};

/**
 * A calendar entry. The visible text is "<layer prefix> <title>", e.g.
 * "יעד: #2026-031 · כהן משה". Draggable when moving its date is allowed.
 */
export function CalendarChip({ item, onOpen, compact = false }: Props) {
  const t = useTranslations('calendar');
  const prefix = t(`prefix.${item.layer}`, { detail: item.detail ?? '' });
  const style = item.overdue ? OVERDUE_STYLE : LAYER_STYLE[item.layer];
  const Direction = item.direction === 'back' ? ArrowDownLeft : ArrowUpLeft;

  return (
    <button
      type="button"
      draggable={item.editable !== null}
      onDragStart={(e) => e.dataTransfer.setData('text/calendar-item', item.key)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      title={`${prefix} ${item.title}`}
      className={`flex w-full min-w-0 items-center gap-1 rounded border px-1.5 text-start text-[11px] leading-5 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 ${style} ${
        item.editable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {item.time && <span className="shrink-0 tabular-nums opacity-70" dir="ltr">{item.time}</span>}
      {item.layer === 'stage' && (
        <Direction
          className={`size-3 shrink-0 ${item.direction === 'back' ? 'text-red-600' : ''}`}
          aria-label={t(item.direction === 'back' ? 'back' : 'forward')}
        />
      )}
      <span className={`min-w-0 ${compact ? 'truncate' : ''}`}>
        <span className="font-medium">{prefix}</span> {item.title}
        {!compact && item.caseLabel && item.caseLabel !== item.title && (
          <span className="block truncate opacity-70">{item.caseLabel}</span>
        )}
      </span>
    </button>
  );
}
