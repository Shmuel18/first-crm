import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { AgreementTemplateEditor } from '@/features/agreements/components/agreement-template-editor';
import { getAgreementTemplate } from '@/features/agreements/services/agreement-text.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

/**
 * Settings → Engagement agreement. Admin-only: this is the legal text every
 * client signs, so it is deliberately NOT delegated with send_client_agreement
 * (which only lets someone send the agreement, not rewrite it).
 */
export default async function AgreementSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const [he, en, t] = await Promise.all([
    getAgreementTemplate('he'),
    getAgreementTemplate('en'),
    getTranslations('agreements.template'),
  ]);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      <AgreementTemplateEditor initial={{ he, en }} />
    </div>
  );
}
