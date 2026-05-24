'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';

import { updateProfileAction } from '../actions/update-profile';
import { SETTINGS_ACTION_INITIAL, type MyProfile, type SettingsActionState } from '../types';

type Props = { profile: MyProfile; roleName: string };

export function ProfileForm({ profile, roleName }: Props) {
  const t = useTranslations('settings.profile');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateProfileAction,
    SETTINGS_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok === true) toast.success(t('saved'));
  }, [state, t]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = profile as unknown as Record<string, unknown>;
  // Snapshot caused a base-ui DOM re-sync that locked the inputs; see
  // BorrowerForm. Reverted to the live lookup.
  const value = (name: string) => fieldDefault(name, submitted, initialRecord);

  const genericError =
    state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown')
      ? t('errors.generic')
      : null;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormSection title={t('sections.personal')}>
        <FormField label={t('fields.firstName')} error={fieldErrors.first_name}>
          <Input name="first_name" defaultValue={value('first_name')} />
        </FormField>
        <FormField label={t('fields.lastName')} error={fieldErrors.last_name}>
          <Input name="last_name" defaultValue={value('last_name')} />
        </FormField>
        <FormField label={t('fields.phone')} error={fieldErrors.phone}>
          <Input name="phone" type="tel" defaultValue={value('phone')} dir="ltr" />
        </FormField>
        <FormField label={t('fields.language')} error={fieldErrors.language}>
          <NativeSelect name="language" defaultValue={value('language') || 'he'}>
            <option value="he">{t('languages.he')}</option>
            <option value="en">{t('languages.en')}</option>
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title={t('sections.account')}>
        <FormField label={t('fields.email')}>
          <Input value={profile.email ?? ''} disabled dir="ltr" />
        </FormField>
        <FormField label={t('fields.role')}>
          <Input value={roleName} disabled />
        </FormField>
      </FormSection>

      {genericError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {genericError}
        </div>
      )}

      <div className="flex justify-start pt-4 border-t">
        <SubmitButton label={tc('save')} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#C9A961] hover:bg-[#E8D5A2] text-[#0A0A0A] font-semibold h-11 min-w-32"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : label}
    </Button>
  );
}
