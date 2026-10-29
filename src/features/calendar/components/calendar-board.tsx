'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { filterItems, groupByDay } from '../domain/calendar-items';
import { rangeFor, shiftAnchor } from '../domain/calendar-range';
import { useCalendarActions } from '../hooks/use-calendar-actions';
import { useCalendarLayers } from '../hooks/use-calendar-prefs';
import type { CalendarEventRecord, CalendarItem, CalendarView } from '../types';

import { CalendarAgenda } from './calendar-agenda';
import { CalendarEventForm, type CaseChoice } from './calendar-event-form';
import { CalendarFilters, type AdvisorChoice } from './calendar-filters';
import { CalendarItemDialog } from './calendar-item-dialog';
import { CalendarMonth } from './calendar-month';
import { CalendarTimeGrid } from './calendar-time-grid';
import { CalendarToolbar } from './calendar-toolbar';

type Props = {
  view: CalendarView;
  anchor: string;
  today: string;
  items: ReadonlyArray<CalendarItem>;
  events: Readonly<Record<string, CalendarEventRecord>>;
  currentUserId: string;
  canManageTeam: boolean;
  /** Other staff, for the advisor filter (empty when the viewer sees only their own). */
  advisors: ReadonlyArray<AdvisorChoice>;
  staff: ReadonlyArray<AdvisorChoice>;
  cases: ReadonlyArray<CaseChoice>;
};

type FormState = CalendarEventRecord | { day: string; time: string | null } | null;

/** The calendar page's client side: filters, views, dialogs, drag & drop. */
export function CalendarBoard(props: Props) {
  const { view, anchor, today, items, events, currentUserId, canManageTeam, advisors, staff, cases } = props;
  const router = useRouter();
  const { layers, toggleLayer } = useCalendarLayers();
  const actions = useCalendarActions();
  const [advisorIds, setAdvisorIds] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [openItem, setOpenItem] = useState<CalendarItem | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const range = rangeFor(view, anchor);
  const byDay = useMemo(
    () => groupByDay(filterItems(items, { layers, advisorIds, query })),
    [items, layers, advisorIds, query],
  );

  const go = (nextView: CalendarView, nextAnchor: string): void =>
    router.push(`/calendar?view=${nextView}&date=${nextAnchor}`);
  const toggleAdvisor = (id: string): void =>
    setAdvisorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const drop = (key: string, day: string): void => {
    const item = items.find((i) => i.key === key);
    if (item) void actions.move(item, day);
  };

  return (
    <div className="space-y-3">
      <CalendarToolbar
        view={view}
        anchor={anchor}
        query={query}
        onQuery={setQuery}
        onView={(v) => go(v, anchor)}
        onStep={(step) => go(view, shiftAnchor(view, anchor, step))}
        onToday={() => go(view, today)}
        onNewEvent={() => setForm({ day: view === 'month' ? today : anchor, time: null })}
        filters={
          <CalendarFilters
            layers={layers}
            onToggleLayer={toggleLayer}
            advisors={advisors}
            advisorIds={advisorIds}
            onToggleAdvisor={toggleAdvisor}
          />
        }
      />

      {/* Phones get the month as a day-by-day list — a 7-column grid is unreadable there. */}
      {view === 'month' && (
        <div className="md:hidden">
          <CalendarAgenda days={range.days} today={today} byDay={byDay} onOpenItem={setOpenItem} />
        </div>
      )}
      {view === 'month' && (
        <div className="hidden md:block">
        <CalendarMonth
          days={range.days}
          month={anchor.slice(0, 7)}
          today={today}
          byDay={byDay}
          onOpenItem={setOpenItem}
          onOpenDay={(day) => go('day', day)}
          onCreate={(day) => setForm({ day, time: null })}
          onDropItem={drop}
        />
        </div>
      )}
      {(view === 'week' || view === 'day') && (
        <CalendarTimeGrid
          days={range.days}
          today={today}
          byDay={byDay}
          onOpenItem={setOpenItem}
          onCreate={(day, time) => setForm({ day, time })}
          onDropItem={drop}
        />
      )}
      {view === 'agenda' && <CalendarAgenda days={range.days} today={today} byDay={byDay} onOpenItem={setOpenItem} />}

      {openItem && (
        <CalendarItemDialog
          key={openItem.key}
          item={openItem}
          onClose={() => setOpenItem(null)}
          onMove={actions.move}
          onCompleteTask={actions.completeTask}
          onDeleteEvent={actions.deleteEvent}
          onEditEvent={(id) => {
            const record = events[id];
            setOpenItem(null);
            if (record) setForm(record);
          }}
        />
      )}
      {form && (
        <CalendarEventForm
          initial={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            router.refresh();
          }}
          currentUserId={currentUserId}
          canManageTeam={canManageTeam}
          staff={staff}
          cases={cases}
        />
      )}
    </div>
  );
}
