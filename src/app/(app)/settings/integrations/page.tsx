import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { DriveIntegrationCard } from '@/features/integrations/components/drive-integration-card';
import { getDriveIntegrationView } from '@/features/integrations/services/integrations.service';
import { isGoogleOAuthConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

type Props = { searchParams: Promise<{ error?: string; connected?: string }> };

export default async function IntegrationsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) redirect('/cases');

  const params = await searchParams;
  const t = await getTranslations('settings.integrations');

  const view = await getDriveIntegrationView();

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-xl font-semibold text-neutral-900">
          {t('title')}
        </h2>
        <p className="text-sm text-neutral-500 mt-1">{t('subtitle')}</p>
      </header>

      <DriveIntegrationCard
        view={view}
        oauthConfigured={isGoogleOAuthConfigured()}
        errorReason={params.error ?? null}
        connectedFlag={params.connected === 'google_drive'}
      />
    </div>
  );
}
