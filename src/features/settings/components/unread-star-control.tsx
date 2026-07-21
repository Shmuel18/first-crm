'use client';

import { useState, useTransition } from 'react';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { UnreadCadence } from '@/features/cases/domain/unread-star';

import { updateUnreadStarAction } from '../actions/update-unread-star';

type Props = { initialCadence: UnreadCadence; initialWeekday: number };

const CADENCES: readonly UnreadCadence[] = ['off', 'daily', 'weekly'];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Admin-only: office-wide cadence for the dashboard "unread" star. Cadence +
 * (for weekly) which weekday resets it. Saves optimistically on change and
 * reverts the pair on failure so the controls never lie about what's stored.
 */
export function UnreadStarControl({ initialCadence, initialWeekday }: Props) {
  const t = useTranslations('settings.display.unreadStar');
  const [cadence, setCadence] = useState<UnreadCadence>(initialCadence);
  const [weekday, setWeekday] = useState<number>(initialWeekday);
  const [pending, startTransition] = useTransition();

  const save = (nextCadence: UnreadCadence, nextWeekday: number) => {
    const prevCadence = cadence;
    const prevWeekday = weekday;
    setCadence(nextCadence);
    setWeekday(nextWeekday);

    startTransition(async () => {
      try {
        const result = await updateUnreadStarAction(nextCadence, nextWeekday);
        if (result.ok) {
          toast.success(t('saved'));
          return;
        }
      } catch {
        // network / dropped connection — fall through to revert
      }
      setCadence(prevCadence);
      setWeekday(prevWeekday);
      toast.error(t('failed'));
    });
  };

  const selectClass =
    'rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 ' +
    'focus-visible:border-brand-gold-text focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-brand-gold-text/30 disabled:cursor-wait disabled:opacity-70';

  return (
    <section className="border-brand-gold/35 bg-brand-gold-soft/50 overflow-hidden rounded-xl border">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="bg-brand-gold/20 text-brand-gold-text mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <Star className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">{t('title')}</h3>
              <span className="bg-brand-black rounded-full px-2 py-0.5 text-[10px] font-medium text-white">
                {t('adminOnly')}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">{t('description')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 ps-12">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="select-none">{t('cadenceLabel')}</span>
            <select
              value={cadence}
              disabled={pending}
              onChange={(e) => save(e.target.value as UnreadCadence, weekday)}
              className={selectClass}
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {t(`cadence.${c}`)}
                </option>
              ))}
            </select>
          </label>

          {cadence === 'weekly' && (
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              <span className="select-none">{t('weekdayLabel')}</span>
              <select
                value={weekday}
                disabled={pending}
                onChange={(e) => save(cadence, Number(e.target.value))}
                className={selectClass}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {t(`weekdays.${d}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </section>
  );
}
