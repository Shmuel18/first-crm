import { redirect } from 'next/navigation';

import { Clock } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { ClockPunch } from '@/features/time-clock/components/clock-punch';
import { ManagerPanel } from '@/features/time-clock/components/manager-panel';
import {
  getBoard,
  getClockAccess,
  getMyOpenEntry,
  listMyEntries,
  listStaffForTracking,
} from '@/features/time-clock/services/time-clock.service';
import { parseLocale } from '@/lib/i18n/direction';

export default async function TimeClockPage() {
  const access = await getClockAccess();
  if (!access.isTracked && !access.isManager) redirect('/cases');

  const [locale, t, openEntry, myEntries, board, staff] = await Promise.all([
    getLocale().then(parseLocale),
    getTranslations('timeClock'),
    access.isTracked ? getMyOpenEntry() : Promise.resolve(null),
    access.isTracked ? listMyEntries() : Promise.resolve([]),
    access.isManager ? getBoard() : Promise.resolve([]),
    access.isManager ? listStaffForTracking() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-gold-text">
          <Clock className="size-3.5" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-950">{t('title')}</h1>
      </header>

      {access.isTracked && (
        <ClockPunch initialOpen={openEntry} initialEntries={myEntries} locale={locale} />
      )}

      {access.isManager && (
        <>
          {access.isTracked && <hr className="border-neutral-200" />}
          <ManagerPanel board={board} staff={staff} locale={locale} />
        </>
      )}
    </div>
  );
}
