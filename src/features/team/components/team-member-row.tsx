'use client';

import { useState, useTransition } from 'react';

import { Mail, Power, PowerOff, Send, Trash2 } from 'lucide-react';
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
import { roleManagementLabel } from '@/lib/auth/role-label';
import { formatPersonName } from '@/lib/utils/person-name';

import { deleteMemberAction } from '../actions/delete-member';
import { resendInviteAction } from '../actions/resend-invite';
import { setMemberActiveAction } from '../actions/set-member-active';
import { updateMemberRoleAction } from '../actions/update-member-role';
import { ResendLinkDialog } from './resend-link-dialog';
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
  const tLevel = useTranslations('settings.roles.levels');
  const [pending, startTransition] = useTransition();
  const [resendLink, setResendLink] = useState<string | null>(null);

  const fullName =
    formatPersonName(member.first_name, member.last_name) || tc('noName');
  const initials = (member.first_name?.[0] ?? member.email?.[0] ?? '?').toUpperCase();
  const roleName = (r: TeamRole) => roleManagementLabel(r, locale, tLevel);

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

  const handleResend = () => {
    startTransition(async () => {
      const res = await resendInviteAction(member.id);
      if (!res.ok) {
        toast.error(t('toast.actionFailed'));
        return;
      }
      if (res.emailed) {
        toast.success(t('toast.resentEmail'));
      } else if (res.inviteLink) {
        // Email not configured — surface the one-time link for manual sharing.
        setResendLink(res.inviteLink);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteMemberAction(member.id);
      if (res.ok) {
        toast.success(t('toast.deleted'));
      } else if (res.error === 'self_delete') {
        toast.error(t('toast.selfDelete'));
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
      <div className="size-10 rounded-full bg-brand-black text-brand-gold flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-brand-gold/30">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-900 truncate">{fullName}</p>
          {isSelf && <span className="text-[10px] font-medium text-brand-gold-text">({t('you')})</span>}
          {!member.is_active && (
            <span className="inline-flex items-center px-1.5 h-5 rounded-full text-[10px] font-medium bg-neutral-200 text-neutral-800">
              {t('status.inactive')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
          <Mail className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate" dir="ltr">{member.email}</span>
        </div>
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

      {!isSelf && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={handleResend}
          aria-label={t('action.resend')}
          title={t('action.resend')}
        >
          <Send className="size-4 text-brand-gold-text" />
        </Button>
      )}

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

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending || isSelf}
              aria-label={t('action.delete')}
              title={isSelf ? t('toast.selfDelete') : t('action.delete')}
            />
          }
        >
          <Trash2 className="size-4 text-red-600" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteConfirm.body', { name: fullName })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button variant="destructive" onClick={handleDelete}>
                  {t('action.delete')}
                </Button>
              }
            />
            <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResendLinkDialog link={resendLink} onClose={() => setResendLink(null)} />
    </div>
  );
}
