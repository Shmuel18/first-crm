import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { TeamTable } from '@/features/team/components/team-table';
import { listRoles, listTeamMembers } from '@/features/team/services/team.service';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) redirect('/cases');

  const t = await getTranslations('team');
  const locale = (await getLocale()) as Locale;

  const [members, roles] = await Promise.all([listTeamMembers(), listRoles()]);

  return (
    <div className="space-y-5 -mt-6">
      <div>
        <h1 className="text-2xl font-light text-neutral-900">{t('title')}</h1>
        <p className="text-sm text-neutral-500 mt-1">{t('subtitle')}</p>
      </div>

      <TeamTable
        members={members}
        roles={roles}
        currentUserId={userRes.user.id}
        locale={locale}
      />
    </div>
  );
}
