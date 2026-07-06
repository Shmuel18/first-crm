import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { PeopleTabsShell } from '@/features/settings/components/people-tabs-shell';
import { RolesPermissionsEditor } from '@/features/settings/components/roles-permissions-editor';
import { UserPermissionsEditor } from '@/features/settings/components/user-permissions-editor';
import {
  getRolesPermissions,
  getUserPermissionOverrides,
} from '@/features/settings/services/permissions.service';
import { TeamTable } from '@/features/team/components/team-table';
import { listRoles, listTeamMembers } from '@/features/team/services/team.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings.people');
  return { title: t('title'), description: t('subtitle') };
}

/**
 * Combined people/permissions tab. Inner pills (אנשים / תפקידים) backed by
 * the URL ?tab=members|roles param. Old /settings/team and /settings/roles
 * paths redirect here so any links stay live.
 */
export default async function PeopleSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('settings.people');
  const locale = parseLocale(await getLocale());

  // Fetch both datasets in parallel — admin-only page hit by 1 user, both
  // sub-tabs are small queries, so render-time parallelism beats lazy.
  const [members, teamRoles, rolesPerms, overrides] = await Promise.all([
    listTeamMembers(),
    listRoles(),
    getRolesPermissions(),
    getUserPermissionOverrides(),
  ]);

  // Per-user editor works on active members only (inactive can't log in). Role
  // name is shown as the "default" context; admin members are locked (fixed).
  const permMembers = members
    .filter((m) => m.is_active)
    .map((m) => ({
      id: m.id,
      name: formatPersonName(m.first_name, m.last_name) || m.email || '—',
      roleId: m.role?.id ?? null,
      roleName: m.role ? (locale === 'he' ? m.role.name_he : m.role.name_en) : '',
      isAdmin: m.role?.key === 'admin',
    }));

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <PeopleTabsShell
        membersSlot={
          <TeamTable
            members={members}
            roles={teamRoles}
            currentUserId={userRes.user.id}
            locale={locale}
          />
        }
        rolesSlot={
          <RolesPermissionsEditor
            roles={rolesPerms.roles}
            permissions={rolesPerms.permissions}
            granted={rolesPerms.granted}
            locale={locale}
          />
        }
        permsSlot={
          <UserPermissionsEditor
            members={permMembers}
            permissions={rolesPerms.permissions}
            granted={rolesPerms.granted}
            overrides={overrides}
            locale={locale}
          />
        }
      />
    </div>
  );
}
