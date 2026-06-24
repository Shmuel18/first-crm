import { redirect } from 'next/navigation';

import { Coins } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { listAdvisorOptions } from '@/features/cases/services/case-lookups.service';
import { CollectionsOverview } from '@/features/collections/components/collections-overview';
import { getCollectionsOverview } from '@/features/collections/services/collections.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

export default async function CollectionsPage() {
  // Gated on view_collections — the collections_overview RPC + case_fee_payments
  // RLS enforce the same boundary server-side; this is the user-facing guard.
  if (!(await userHasPermission('view_collections'))) redirect('/cases');

  const [rows, advisors, t, locale] = await Promise.all([
    getCollectionsOverview(),
    listAdvisorOptions(),
    getTranslations('collections'),
    getLocale().then(parseLocale),
  ]);

  const advisorNames: Record<string, string> = {};
  for (const a of advisors) {
    advisorNames[a.id] = formatPersonName(a.first_name, a.last_name);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
          <Coins className="size-4" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>
      <CollectionsOverview rows={rows} advisorNames={advisorNames} locale={locale} />
    </div>
  );
}
