'use client';

import { useTransition } from 'react';

import { Briefcase, CheckSquare, Power, PowerOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/shared/form-fields';

import { setMemberActiveAction } from '../actions/set-member-active';
import { updateMemberRoleAction } from '../actions/update-member-role';
import type { TeamMember, TeamRole } from '../types';

type Props = {
  member: TeamMember;
  roles: ReadonlyArray<TeamRole>;
  locale: 'he' | 'en';
  isSelf: boolean;
};

export function TeamMemberRow({ member, roles, locale, isSelf }: Props) {
  const t = useTranslations('team');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const fullName =
    [member.first_name, member.last_name].filter(Boolean).join(' ') || tc('noName');
  const initials = (member.first_name?.[0] ?? member.email?.[0] ?? '?').toUpperCase();
  const roleName = (r: TeamRole) => (locale === 'he' ? r.name_he : r.name_en);

  const handleRoleChange = (roleId: string) => {
    startTransition(async () => {
      const res = await updateMemberRoleAction(member.id, roleId);
      if (res.ok) {
        toast.success(t('toast.roleUpdated'));
      } else if (res.error === 'self_role_change') {
        toast.error(t('toast.selfRoleChange'));
      } else {
        toast.error(t('toast.actionFailed'));
      }
    });
  };

  const handleSetActive = (isActive: boolean) => {
    startTransition(async () => {
      const res = await setMemberActiveAction(member.id, isActive);
      if (res.ok) {
        toast.success(isActive ? t('toast.reactivated') : t('toast.deactivated'));
      } else if (res.error === 'self_deactivate') {
        toast.error(t('toast.selfDeactivate'));
      } else {
        toast.error(t('toast.actionFailed'));
      }
    });
  };

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50/60 transition-colors',
        member.is_active ? '' : 'opacity-60 bg-neutral-50/60',
      ].join(' ')}
    >
      <div className="size-10 rounded-full bg-[#0A0A0A] text-[#C9A961] flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-[#C9A961]/30">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-900 truncate">{fullName}</p>
          {isSelf && <span className="text-[10px] text-neutral-600">({t('you')})</span>}
          {!member.is_active && (
            <span className="inline-flex items-center px-1.5 h-5 rounded-full text-[10px] font-medium bg-neutral-200 text-neutral-800">
              {t('status.inactive')}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-600 truncate" dir="ltr">{member.email}</p>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-[11px] text-neutral-700">
        <span
          aria-label={`${t('columns.cases')}: ${member.activeCasesCount}`}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-50 border border-neutral-200 px-2 py-1 tabular-nums"
        >
          <Briefcase className="size-3.5 text-[#A88840]" aria-hidden="true" />
          {member.activeCasesCount}
        </span>
        <span
          aria-label={`${t('columns.tasks')}: ${member.openTasksCount}`}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-50 border border-neutral-200 px-2 py-1 tabular-nums"
        >
          <CheckSquare className="size-3.5 text-[#A88840]" aria-hidden="true" />
          {member.openTasksCount}
        </span>
      </div>

      <NativeSelect
        value={member.role?.id ?? ''}
        onChange={(e) => handleRoleChange(e.target.value)}
        disabled={pending || !member.is_active || isSelf}
        aria-label={`${t('invite.role')} — ${fullName}`}
        title={isSelf ? t('toast.selfRoleChange') : undefined}
        className="w-36 h-8 text-xs"
      >
        {!member.role && <option value="">—</option>}
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{roleName(r)}</option>
        ))}
      </NativeSelect>

      {member.is_active ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending || isSelf}
                aria-label={t('action.deactivate')}
                title={isSelf ? t('toast.selfDeactivate') : t('action.deactivate')}
              />
            }
          >
            <PowerOff className="size-4 text-red-500" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{t('deactivateConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deactivateConfirm.body', { name: fullName })}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel
                render={
                  <Button
                    variant="destructive"
                    onClick={() => handleSetActive(false)}
                  >
                    {t('action.deactivate')}
                  </Button>
                }
              />
              <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => handleSetActive(true)}
          aria-label={t('action.reactivate')}
          title={t('action.reactivate')}
        >
          <Power className="size-4 text-green-600" />
        </Button>
      )}
    </div>
  );
}
