'use client';

import { Bell, BellOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { usePushSubscription } from '../hooks/use-push-subscription';

/**
 * Settings card to turn device push notifications on/off for the current
 * device. Hidden entirely when push isn't configured on the deploy (no VAPID
 * key). Shows an "unsupported" hint on browsers without Push (e.g. iOS Safari
 * before the PWA is installed). One subscription per device.
 */
export function PushToggle() {
  const t = useTranslations('settings.push');
  const { ready, supported, configured, subscribed, busy, enable, disable } = usePushSubscription();

  if (!configured || !ready) return null;

  const onEnable = async () => {
    const res = await enable();
    if (res.ok) toast.success(t('enabled'));
    else if (res.reason === 'denied') toast.error(t('denied'));
    else toast.error(t('failed'));
  };

  const onDisable = async () => {
    await disable();
    toast.success(t('disabled'));
  };

  return (
    <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">{t('title')}</h3>
          <p className="mt-0.5 text-sm text-neutral-500">{t('desc')}</p>
          {!supported && <p className="mt-1.5 text-xs text-amber-600">{t('unsupported')}</p>}
        </div>
        {supported &&
          (subscribed ? (
            <button
              type="button"
              onClick={onDisable}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 disabled:opacity-50"
            >
              <BellOff className="size-4" aria-hidden="true" />
              {t('disable')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-black transition hover:bg-brand-gold-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
            >
              <Bell className="size-4" aria-hidden="true" />
              {t('enable')}
            </button>
          ))}
      </div>
    </section>
  );
}
