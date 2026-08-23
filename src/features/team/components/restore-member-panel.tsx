'use client';

import { useTransition } from 'react';

import { Loader2, UserRoundCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/actions/call-action';

import { resendInviteAction } from '../actions/resend-invite';
import { restoreMemberAction } from '../actions/restore-member';

type Props = {
  member: { id: string; name: string };
  /** The details just typed into the invite form — re-applied on restore, so
   *  a role or phone change made now sticks. */
  values: Partial<Record<string, string>>;
  onRestored: () => void;
};

/**
 * Shown when the invited address belongs to a removed member. Deleting a
 * member is a soft delete that leaves their login intact, so the way back is a
 * restore, not a second account — a second account would split their history
 * across two profiles.
 */
export function RestoreMemberPanel({ member, values, onRestored }: Props) {
  const t = useTranslations('team.invite.restore');
  const [pending, startTransition] = useTransition();

  const restore = (): void => {
    startTransition(async () => {
      const res = await callAction(() =>
        restoreMemberAction({
          userId: member.id,
          first_name: values.first_name ?? '',
          last_name: values.last_name ?? '',
          phone: values.phone ?? '',
          role_id: values.role_id ?? '',
        }),
      );
      if (!res.ok) {
        toast.error(t(res.error === 'unauthorized' ? 'errors.unauthorized' : 'errors.generic'));
        return;
      }
      if (res.needsInvite) {
        // Never finished onboarding the first time — mint a fresh set-password
        // link through the guarded resend path.
        const link = await callAction(() => resendInviteAction(member.id));
        toast.success(link.ok && link.emailed ? t('restoredAndEmailed') : t('restoredNeedsLink'));
      } else {
        toast.success(t('restored', { name: member.name }));
      }
      onRestored();
    });
  };

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
    >
      <p className="font-medium">{t('title', { name: member.name })}</p>
      <p className="text-xs">{t('body')}</p>
      <Button
        type="button"
        onClick={restore}
        disabled={pending}
        className="h-9 bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UserRoundCheck className="size-4 me-1" />
        )}
        {t('action')}
      </Button>
    </div>
  );
}
