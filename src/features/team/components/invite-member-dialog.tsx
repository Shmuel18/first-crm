'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Check, Copy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FormField, NativeSelect } from '@/components/shared/form-fields';

import { inviteMemberAction } from '../actions/invite-member';
import { INVITE_ACTION_INITIAL, type InviteActionState, type TeamRole } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: ReadonlyArray<TeamRole>;
  locale: 'he' | 'en';
};

export function InviteMemberDialog({ open, onOpenChange, roles, locale }: Props) {
  const t = useTranslations('team.invite');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<InviteActionState, FormData>(
    inviteMemberAction,
    INVITE_ACTION_INITIAL,
  );

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const val = (name: string) => submitted?.[name] ?? '';

  const roleName = (r: TeamRole) => (locale === 'he' ? r.name_he : r.name_en);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {state.ok === true ? (
          <InviteSuccess
            email={state.email}
            tempPassword={state.tempPassword}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
            </DialogHeader>

            <form action={formAction} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('firstName')} required error={fieldErrors.first_name}>
                  <Input name="first_name" defaultValue={val('first_name')} autoFocus />
                </FormField>
                <FormField label={t('lastName')} required error={fieldErrors.last_name}>
                  <Input name="last_name" defaultValue={val('last_name')} />
                </FormField>
              </div>

              <FormField label={t('email')} required error={fieldErrors.email}>
                <Input name="email" type="email" defaultValue={val('email')} dir="ltr" />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('phone')} error={fieldErrors.phone}>
                  <Input name="phone" type="tel" defaultValue={val('phone')} dir="ltr" />
                </FormField>
                <FormField label={t('role')} required error={fieldErrors.role_id}>
                  <NativeSelect name="role_id" defaultValue={val('role_id')}>
                    <option value="">{tc('select')}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{roleName(r)}</option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>

              {getGenericError(state, t) && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {getGenericError(state, t)}
                </div>
              )}

              <p className="text-xs text-neutral-500">{t('tempPasswordNote')}</p>

              <DialogFooter>
                <SubmitButton />
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tc('cancel')}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InviteSuccess({
  email,
  tempPassword,
  onDone,
}: {
  email: string;
  tempPassword: string;
  onDone: () => void;
}) {
  const t = useTranslations('team.invite');
  const tc = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('successTitle')}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-neutral-600">{t('successBody', { email })}</p>
      <div className="rounded-lg border border-[#C9A961]/40 bg-[#FAF8F3] p-3 space-y-2">
        <p className="text-xs text-neutral-500">{t('tempPasswordLabel')}</p>
        <div className="flex items-center justify-between gap-3">
          <code className="text-base font-mono font-semibold text-neutral-900" dir="ltr">
            {tempPassword}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? tc('copied') : tc('copy')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-amber-700">{t('tempPasswordWarning')}</p>
      <DialogFooter>
        <Button type="button" onClick={onDone} className="bg-[#0A0A0A] hover:bg-neutral-800 text-white">
          {tc('done')}
        </Button>
      </DialogFooter>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('team.invite');
  return (
    <Button type="submit" disabled={pending} className="bg-[#0A0A0A] hover:bg-neutral-800 text-white">
      {pending ? <Loader2 className="size-4 animate-spin" /> : t('submit')}
    </Button>
  );
}

function getGenericError(
  state: InviteActionState,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (state.ok !== false) return null;
  if (state.error === 'idle' || state.error === 'validation') return null;
  if (state.error === 'unauthorized') return t('errors.unauthorized');
  if (state.error === 'email_exists') return t('errors.emailExists');
  return t('errors.generic');
}
