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
          className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
          size="sm"
        >
          <UserPlus className="size-3.5 me-1.5" />
          {t('addMember')}
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden shadow-sm">
        <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-brand-gold-soft text-[11px] font-medium text-neutral-500">
          <span className="size-10 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0">{t('columns.member')}</span>
          <span className="w-36">{t('columns.role')}</span>
          <span className="w-20 text-end">{t('columns.actions')}</span>
        </div>
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
