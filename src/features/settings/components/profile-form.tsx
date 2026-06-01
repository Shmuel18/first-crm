'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection, NativeSelect } from '@/components/shared/form-fields';

import { updateProfileAction } from '../actions/update-profile';
import { SETTINGS_ACTION_INITIAL, type MyProfile, type SettingsActionState } from '../types';

type Props = { profile: MyProfile; roleName: string };

type EditableProfile = {
  first_name: string;
  last_name: string;
  phone: string;
  language: 'he' | 'en';
};

function seed(p: MyProfile): EditableProfile {
  return {
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    phone: p.phone ?? '',
    language: p.language,
  };
}

export function ProfileForm({ profile, roleName }: Props) {
  const t = useTranslations('settings.profile');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateProfileAction,
    SETTINGS_ACTION_INITIAL,
  );

  // Controlled fields keep the user's input across React 19's post-action form
  // reset. update-profile still revalidates the layout (it switches the UI
  // locale + refreshes the top-bar name); this state re-seeds from the fresh
  // prop afterwards, so there's no revert and no need for the old select `key`.
  const [values, setValues] = useState<EditableProfile>(() => seed(profile));
  const [syncedRef, setSyncedRef] = useState(profile);
  if (syncedRef !== profile) {
    setSyncedRef(profile);
    setValues(seed(profile));
  }

  useEffect(() => {
    if (state.ok === true) toast.success(t('saved'));
  }, [state, t]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const genericError =
    state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown')
      ? t('errors.generic')
      : null;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormSection title={t('sections.personal')}>
        <FormField label={t('fields.firstName')} error={fieldErrors.first_name}>
          <Input
            name="first_name"
            value={values.first_name}
            onChange={(e) => setValues((v) => ({ ...v, first_name: e.target.value }))}
          />
        </FormField>
        <FormField label={t('fields.lastName')} error={fieldErrors.last_name}>
          <Input
            name="last_name"
            value={values.last_name}
            onChange={(e) => setValues((v) => ({ ...v, last_name: e.target.value }))}
          />
        </FormField>
        <FormField label={t('fields.phone')} error={fieldErrors.phone}>
          <Input
            name="phone"
            type="tel"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            dir="ltr"
          />
        </FormField>
        <FormField label={t('fields.language')} error={fieldErrors.language}>
          <NativeSelect
            name="language"
            value={values.language}
            onChange={(e) =>
              setValues((v) => ({ ...v, language: e.target.value === 'en' ? 'en' : 'he' }))
            }
          >
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
      className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold h-11 min-w-32"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : label}
    </Button>
  );
}
