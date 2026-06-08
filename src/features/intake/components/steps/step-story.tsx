'use client';

import { useTranslations } from 'next-intl';

import { FormField } from '@/components/shared/form-fields';
import { Textarea } from '@/components/ui/textarea';

import { PRIVACY_POLICY_URL } from '../../constants';

import type { IntakeFormState, SetTop } from '../../form-state';
import type { IntakeFieldErrors } from '../../types';

type Props = {
  state: IntakeFormState;
  errors: IntakeFieldErrors;
  setTop: SetTop;
};

export function StepStory({ state, errors, setTop }: Props) {
  const t = useTranslations('intake');

  return (
    <div className="space-y-6">
      <FormField label={t('story.requestDetails')} error={errors['request_details']}>
        <Textarea
          rows={5}
          value={state.request_details}
          placeholder={t('story.requestDetailsPlaceholder')}
          onChange={(e) => setTop('request_details', e.target.value)}
        />
      </FormField>

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={state.consent}
            onChange={(e) => setTop('consent', e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-gold"
          />
          <span className="text-sm text-neutral-700">
            {t.rich('story.consent', {
              policy: (chunks) => (
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-brand-gold-text underline underline-offset-2"
                >
                  {chunks}
                </a>
              ),
            })}
          </span>
        </label>
        {errors['consent'] && (
          <p role="alert" className="mt-1.5 text-xs text-red-700">
            {errors['consent']}
          </p>
        )}
      </div>
    </div>
  );
}
