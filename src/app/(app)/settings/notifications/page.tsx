import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { NotificationPreferencesForm } from '@/features/notifications/components/notification-preferences-form';
import { getMyNotificationPreferences } from '@/features/notifications/services/preferences.service';
import { createClient } from '@/lib/supabase/server';

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('settings.notifications');
  const preferences = await getMyNotificationPreferences();

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <NotificationPreferencesForm preferences={preferences} />
    </div>
  );
}
