'use client';

import { useState } from 'react';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { InviteMemberDialog } from './invite-member-dialog';
import { TeamMemberRow } from './team-member-row';
import type { TeamMember, TeamRole } from '../types';

type Props = {
  members: ReadonlyArray<TeamMember>;
  roles: ReadonlyArray<TeamRole>;
  currentUserId: string;
  locale: 'he' | 'en';
};

export function TeamTable({ members, roles, currentUserId, locale }: Props) {
  const t = useTranslations('team');
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-neutral-500">{t('memberCount', { count: members.length })}</p>
        <Button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="bg-[#C9A961] hover:bg-[#E8D5A2] text-[#0A0A0A] font-semibold"
          size="sm"
        >
          <UserPlus className="size-3.5 me-1.5" />
          {t('addMember')}
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden shadow-sm">
        {members.map((member) => (
          <TeamMemberRow
            key={member.id}
            member={member}
            roles={roles}
            locale={locale}
            isSelf={member.id === currentUserId}
          />
        ))}
      </div>

      {inviteOpen && (
        <InviteMemberDialog
          open
          onOpenChange={(o) => !o && setInviteOpen(false)}
          roles={roles}
          locale={locale}
        />
      )}
    </div>
  );
}
