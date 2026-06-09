import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { BanksManager } from '@/features/settings/components/banks-manager';
import { listAllBanks } from '@/features/settings/services/banks.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function BanksSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const banks = await listAllBanks();
  const t = await getTranslations('settings.banks');

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      <BanksManager banks={banks} />
    </div>
  );
}
