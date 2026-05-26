import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { getMyNotificationPreferences } from '@/features/notifications/services/preferences.service';
import { NotificationsForm } from '@/features/settings/components/notifications-form';
import { getSlaThresholds, listSlaStatuses } from '@/features/settings/services/sla.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';

/**
 * Notifications settings hosts two concerns under one nav entry — both
 * are about "when do I get pinged":
 *
 *   1. Email preferences (visible to all users) — which task events
 *      generate an outbound email.
 *   2. Per-status SLA thresholds (admin-only) — how long a case can sit
 *      in a status before the system raises a bell notification.
 *
 * Both sections live inside ONE form with ONE Save button — consolidating
 * them avoids a confusing two-button UX and one round-trip instead of two.
 */
export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('settings.notifications');
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
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <NotificationsForm
        preferences={preferences}
        thresholds={thresholds}
        statuses={statuses}
        showSla={isAdmin}
        locale={locale}
      />
    </div>
  );
}
