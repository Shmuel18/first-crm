import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { NotificationPreferencesForm } from '@/features/notifications/components/notification-preferences-form';
import { getMyNotificationPreferences } from '@/features/notifications/services/preferences.service';
import { SlaForm } from '@/features/settings/components/sla-form';
import { getSlaThresholds, listSlaStatuses } from '@/features/settings/services/sla.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';

/**
 * Notifications settings hosts two distinct concerns under one nav entry —
 * both are about "when do I get pinged":
 *
 *   1. Email preferences (visible to all users) — which task events generate
 *      an outbound email.
 *   2. Per-status SLA thresholds (admin-only) — how long a case can sit in
 *      a status before the system raises a bell notification for the
 *      assigned advisor + the manager.
 *
 * Consolidating them here (instead of a separate /settings/sla page)
 * matches the user's mental model: "where do I configure notifications?".
 */
export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('settings.notifications');
  const tSla = await getTranslations('settings.sla');
  const isAdmin = await isCurrentUserAdmin();

  // SLA data fetched in parallel only for admins — non-admins never see the
  // section so there's no point spending the round-trips.
  const [preferences, statuses, thresholds, rawLocale] = await Promise.all([
    getMyNotificationPreferences(),
    isAdmin ? listSlaStatuses() : Promise.resolve([]),
    isAdmin ? getSlaThresholds() : Promise.resolve({}),
    getLocale(),
  ]);
  const locale = parseLocale(rawLocale);

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <section>
        <NotificationPreferencesForm preferences={preferences} />
      </section>

      {isAdmin && (
        <section className="pt-8 border-t border-neutral-200">
          <header className="mb-4">
            <h3 className="text-base font-semibold text-neutral-900">{tSla('title')}</h3>
            <p className="text-sm text-neutral-500 mt-0.5">{tSla('subtitle')}</p>
          </header>
          <SlaForm statuses={statuses} thresholds={thresholds} locale={locale} />
        </section>
      )}
    </div>
  );
}
