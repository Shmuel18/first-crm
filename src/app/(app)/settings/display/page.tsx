import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { getMyCaseBlockPreferences } from '@/features/cases/services/case-block-preferences.service';
import { InstallAppControl } from '@/features/pwa/components/install-app-control';
import { CaseBlocksForm } from '@/features/settings/components/case-blocks-form';
import { DocumentationCelebrationsControl } from '@/features/settings/components/documentation-celebrations-control';
import { getDocumentationCelebrationsEnabled } from '@/features/settings/services/settings.service';
import { createClient } from '@/lib/supabase/server';

/**
 * Display preferences (per user). Currently one concern: which blocks on the
 * case detail page open by default. The page is a stack of collapsible blocks,
 * all closed by default — here a user picks which open on load.
 */
export default async function DisplaySettingsPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('settings.display');
  const [preferences, celebrationsEnabled, { data: isAdmin }] = await Promise.all([
    getMyCaseBlockPreferences(),
    getDocumentationCelebrationsEnabled(),
    supabase.rpc('is_admin'),
  ]);

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      {isAdmin === true && (
        <div className="mb-8">
          <DocumentationCelebrationsControl initialEnabled={celebrationsEnabled} />
        </div>
      )}

      <CaseBlocksForm preferences={preferences} />

      <div className="mt-8">
        <InstallAppControl />
      </div>
    </div>
  );
}
