import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Users } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { PageHeader } from '@/components/shared/page-header';
import { TeamTable } from '@/features/team/components/team-table';
import { listRoles, listTeamMembers } from '@/features/team/services/team.service';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('team');
  return { title: t('title'), description: t('subtitle') };
}

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
    <div className="space-y-5">
      <PageHeader icon={<Users />} title={t('title')} subtitle={t('subtitle')} />

      <TeamTable
        members={members}
        roles={roles}
        currentUserId={userRes.user.id}
        locale={locale}
      />
    </div>
  );
}
