'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection } from '@/components/shared/form-fields';

import { updateOfficeAction } from '../actions/update-office';
import { SETTINGS_ACTION_INITIAL, type OfficeSettings, type SettingsActionState } from '../types';

type Props = { office: OfficeSettings };

export function OfficeForm({ office }: Props) {
  const t = useTranslations('settings.office');
  const tc = useTranslations('common');

  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateOfficeAction,
    SETTINGS_ACTION_INITIAL,
  );

  // Controlled fields. React 19 auto-resets a `<form action>` after the action
  // runs; owning the values keeps the user's input on screen without leaning on
  // a `revalidatePath` round-trip (which is why update-office no longer
  // revalidates — that round-trip was the Save-spinner hang).
  const [values, setValues] = useState<OfficeSettings>(office);
  const [syncedRef, setSyncedRef] = useState(office);
  if (syncedRef !== office) {
    setSyncedRef(office);
    setValues(office);
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

  const set = (name: keyof OfficeSettings, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormSection title={t('sections.identity')}>
        <div className="md:col-span-2">
          <FormField label={t('fields.officeName')} required error={fieldErrors.office_name}>
            <Input
              name="office_name"
              value={values.office_name}
              onChange={(e) => set('office_name', e.target.value)}
            />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label={t('fields.tagline')} error={fieldErrors.office_tagline}>
            <Input
              name="office_tagline"
              value={values.office_tagline ?? ''}
              onChange={(e) => set('office_tagline', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label={t('fields.taxId')} error={fieldErrors.tax_id}>
          <Input
            name="tax_id"
            value={values.tax_id ?? ''}
            onChange={(e) => set('tax_id', e.target.value)}
            dir="ltr"
          />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.contact')}>
        <FormField label={t('fields.phoneMain')} error={fieldErrors.phone_main}>
          <Input
            name="phone_main"
            type="tel"
            value={values.phone_main ?? ''}
            onChange={(e) => set('phone_main', e.target.value)}
            dir="ltr"
          />
        </FormField>
        <FormField label={t('fields.phoneFax')} error={fieldErrors.phone_fax}>
          <Input
            name="phone_fax"
            type="tel"
            value={values.phone_fax ?? ''}
            onChange={(e) => set('phone_fax', e.target.value)}
            dir="ltr"
          />
        </FormField>
        <FormField label={t('fields.emailMain')} error={fieldErrors.email_main}>
          <Input
            name="email_main"
            type="email"
            value={values.email_main ?? ''}
            onChange={(e) => set('email_main', e.target.value)}
            dir="ltr"
          />
        </FormField>
        <FormField label={t('fields.website')} error={fieldErrors.website_url}>
          <Input
            name="website_url"
            value={values.website_url ?? ''}
            onChange={(e) => set('website_url', e.target.value)}
            dir="ltr"
          />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.address')}>
        <div className="md:col-span-2">
          <FormField label={t('fields.street')} error={fieldErrors.address_street}>
            <Input
              name="address_street"
              value={values.address_street ?? ''}
              onChange={(e) => set('address_street', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label={t('fields.city')} error={fieldErrors.address_city}>
          <Input
            name="address_city"
            value={values.address_city ?? ''}
            onChange={(e) => set('address_city', e.target.value)}
          />
        </FormField>
        <FormField label={t('fields.postalCode')} error={fieldErrors.address_postal_code}>
          <Input
            name="address_postal_code"
            value={values.address_postal_code ?? ''}
            onChange={(e) => set('address_postal_code', e.target.value)}
            dir="ltr"
          />
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
