'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { FormField } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { updateMemberEmailAction } from '../actions/update-member-email';
import {
  UPDATE_MEMBER_EMAIL_INITIAL,
  type TeamMember,
  type UpdateMemberEmailActionState,
} from '../types';

type Props = {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UpdateMemberEmailDialog({ member, open, onOpenChange }: Props) {
  const t = useTranslations('team.emailChange');
  const tc = useTranslations('common');
  const [state, formAction] = useActionState<UpdateMemberEmailActionState, FormData>(
    updateMemberEmailAction,
    UPDATE_MEMBER_EMAIL_INITIAL,
  );

  useEffect(() => {
    if (!state.ok) return;
    if (!state.sessionsRevoked) {
      toast.warning(t('toast.updatedSessionWarning'));
    } else if (!state.emailSent) {
      toast.success(t('toast.updatedNoEmail'));
    } else {
      toast.success(t('toast.updated'));
    }
    onOpenChange(false);
  }, [state, onOpenChange, t]);

  const fieldError =
    state.ok === false && state.error === 'validation' ? state.fieldErrors?.email : undefined;
  const submittedEmail =
    state.ok === false && state.error !== 'idle' ? state.values?.email : undefined;
  const genericError = getError(state, t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="user_id" value={member.id} />

          <FormField label={t('currentEmail')}>
            <Input value={member.email ?? ''} disabled dir="ltr" />
          </FormField>

          <FormField label={t('newEmail')} required error={fieldError}>
            <Input
              key={submittedEmail ?? member.email ?? ''}
              name="email"
              type="email"
              defaultValue={submittedEmail ?? ''}
              autoComplete="off"
              autoFocus
              dir="ltr"
            />
          </FormField>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            {t('warning')}
          </div>

          {genericError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('team.emailChange');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : t('submit')}
    </Button>
  );
}

function getError(
  state: UpdateMemberEmailActionState,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (state.ok || state.error === 'idle' || state.error === 'validation') return null;
  if (state.error === 'unauthorized') return t('errors.unauthorized');
  if (state.error === 'not_found') return t('errors.notFound');
  if (state.error === 'self_change') return t('errors.selfChange');
  if (state.error === 'unchanged') return t('errors.unchanged');
  if (state.error === 'email_exists') return t('errors.emailExists');
  if (state.error === 'rate_limited') return t('errors.rateLimited');
  if (state.error === 'out_of_sync') return t('errors.outOfSync');
  return t('errors.generic');
}
