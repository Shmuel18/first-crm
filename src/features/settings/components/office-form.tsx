'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';

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

  useEffect(() => {
    if (state.ok === true) toast.success(t('saved'));
  }, [state, t]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted = state.ok === false && state.error !== 'idle' ? state.values : undefined;
  const initialRecord = office as unknown as Record<string, unknown>;
  const value = (name: string) => fieldDefault(name, submitted, initialRecord);

  const genericError =
    state.ok === false && (state.error === 'unauthorized' || state.error === 'unknown')
      ? t('errors.generic')
      : null;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormSection title={t('sections.identity')}>
        <div className="md:col-span-2">
          <FormField label={t('fields.officeName')} required error={fieldErrors.office_name}>
            <Input name="office_name" defaultValue={value('office_name')} />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label={t('fields.tagline')} error={fieldErrors.office_tagline}>
            <Input name="office_tagline" defaultValue={value('office_tagline')} />
          </FormField>
        </div>
        <FormField label={t('fields.taxId')} error={fieldErrors.tax_id}>
          <Input name="tax_id" defaultValue={value('tax_id')} dir="ltr" />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.contact')}>
        <FormField label={t('fields.phoneMain')} error={fieldErrors.phone_main}>
          <Input name="phone_main" type="tel" defaultValue={value('phone_main')} dir="ltr" />
        </FormField>
        <FormField label={t('fields.phoneFax')} error={fieldErrors.phone_fax}>
          <Input name="phone_fax" type="tel" defaultValue={value('phone_fax')} dir="ltr" />
        </FormField>
        <FormField label={t('fields.emailMain')} error={fieldErrors.email_main}>
          <Input name="email_main" type="email" defaultValue={value('email_main')} dir="ltr" />
        </FormField>
        <FormField label={t('fields.website')} error={fieldErrors.website_url}>
          <Input name="website_url" defaultValue={value('website_url')} dir="ltr" />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.address')}>
        <div className="md:col-span-2">
          <FormField label={t('fields.street')} error={fieldErrors.address_street}>
            <Input name="address_street" defaultValue={value('address_street')} />
          </FormField>
        </div>
        <FormField label={t('fields.city')} error={fieldErrors.address_city}>
          <Input name="address_city" defaultValue={value('address_city')} />
        </FormField>
        <FormField label={t('fields.postalCode')} error={fieldErrors.address_postal_code}>
          <Input name="address_postal_code" defaultValue={value('address_postal_code')} dir="ltr" />
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
