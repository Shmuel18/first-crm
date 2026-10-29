import { getLocale, getTranslations } from 'next-intl/server';

import { CalendarBoard } from '@/features/calendar/components/calendar-board';
import { isCalendarDay, rangeFor } from '@/features/calendar/domain/calendar-range';
import { getCalendarFeed } from '@/features/calendar/services/calendar-feed.service';
import {
  listCalendarCaseChoices,
  listCalendarStaff,
} from '@/features/calendar/services/calendar-choices.service';
import { CALENDAR_VIEWS, type CalendarView } from '@/features/calendar/types';
import { userHasPermissions } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';
import { israelWallClockNow } from '@/lib/utils/israel-time';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isView(v: string | undefined): v is CalendarView {
  return (CALENDAR_VIEWS as readonly string[]).includes(v ?? '');
}

/** /calendar — the office calendar (spec 2026-10-29). Range is server-fetched per view. */
export default async function CalendarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const today = israelWallClockNow().slice(0, 10);
  const rawView = first(sp.view);
  const view: CalendarView = isView(rawView) ? rawView : 'month';
  const rawDate = first(sp.date);
  const anchor = isCalendarDay(rawDate) ? rawDate : today;
  const range = rangeFor(view, anchor);

  const supabase = await createClient();
  // Stage names in the feed follow the UI language.
  const locale = parseLocale(await getLocale());
  const [t, { data: userRes }, perms, feed, staff, cases] = await Promise.all([
    getTranslations('calendar'),
    supabase.auth.getUser(),
    userHasPermissions('manage_team_calendar', 'view_all_cases'),
    getCalendarFeed(range.from, range.to, locale),
    listCalendarStaff(),
    listCalendarCaseChoices(),
  ]);
  const currentUserId = userRes.user?.id ?? '';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h1>
        <p className="text-sm text-neutral-500">{t('subtitle')}</p>
      </header>
      <CalendarBoard
        view={view}
        anchor={anchor}
        today={today}
        items={feed.items}
        events={feed.events}
        currentUserId={currentUserId}
        canManageTeam={perms.manage_team_calendar === true}
        advisors={perms.view_all_cases === true ? staff : []}
        staff={staff}
        cases={cases}
      />
    </div>
  );
}
