'use client';

import { useLocale, useTranslations } from 'next-intl';

import { parseLocale, type Locale } from '@/lib/i18n/direction';

import { ActivityEventLine } from './activity-event-line';

import type { ActivityEvent } from '../types';

// The office operates on Israel time; pinning the grouping timezone keeps the
// server prerender and the client hydration agreeing on which day an event
// belongs to (server runs in UTC).
const OFFICE_TZ = 'Asia/Jerusalem';

function dayKey(iso: string): string {
  // en-CA → YYYY-MM-DD, a stable sortable key.
  return new Intl.DateTimeFormat('en-CA', { timeZone: OFFICE_TZ }).format(new Date(iso));
}

function dayLabel(key: string, locale: Locale, t: (k: string) => string): string {
  const today = dayKey(new Date().toISOString());
  if (key === today) return t('today');
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === yesterday) return t('yesterday');
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    timeZone: OFFICE_TZ,
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(`${key}T12:00:00Z`));
}

/** Events are already sorted newest-first — preserve that order per group. */
function groupByDay(events: ReadonlyArray<ActivityEvent>): Array<{ key: string; events: ActivityEvent[] }> {
  const groups: Array<{ key: string; events: ActivityEvent[] }> = [];
  for (const event of events) {
    const key = dayKey(event.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(event);
    else groups.push({ key, events: [event] });
  }
  return groups;
}

export function CaseActivityFeed({ events }: { events: ReadonlyArray<ActivityEvent> }) {
  const t = useTranslations('caseActivity');
  const locale = parseLocale(useLocale());

  if (events.length === 0) {
    return <p className="px-6 py-12 text-center text-sm text-neutral-600">{t('empty')}</p>;
  }

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6">
      {groupByDay(events).map((group) => (
        <section key={group.key}>
          <h3
            suppressHydrationWarning
            className="mb-3 inline-flex items-center rounded-full bg-brand-gold-soft px-3 py-1 text-xs font-semibold text-brand-gold-text"
          >
            {dayLabel(group.key, locale, t)}
          </h3>
          <div className="relative">
            {/* timeline rail */}
            <span
              aria-hidden="true"
              className="absolute bottom-1 top-1 start-4 -ms-px w-px bg-neutral-200"
            />
            <ul className="space-y-4">
              {group.events.map((event) => (
                <ActivityEventLine key={event.id} event={event} locale={locale} />
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
