'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useIntakeForm } from '../use-intake-form';
import { IntakeNav } from './intake-nav';
import { IntakeProgress } from './intake-progress';
import { StepComposition } from './steps/step-composition';
import { StepIncome } from './steps/step-income';
import { StepPersonal } from './steps/step-personal';
import { StepProperty } from './steps/step-property';
import { StepStory } from './steps/step-story';
import { StepSuccess } from './steps/step-success';

const STEP_KEYS = ['composition', 'personal', 'property', 'income', 'story'] as const;
const SUBMIT_ERROR_KEY = { rate_limited: 'rateLimited', unknown: 'unknown' } as const;

export function IntakeWizard() {
  const locale = useLocale();
  const t = useTranslations('intake');
  const form = useIntakeForm(locale, {
    consentRequired: t('errors.consentRequired'),
    contactRequired: t('errors.contactRequired'),
  });

  if (form.done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <StepSuccess />
      </div>
    );
  }

  const stepKey = STEP_KEYS[form.step - 1] ?? 'composition';

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm sm:p-6">
        <IntakeProgress step={form.step} />
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-display text-2xl font-bold text-neutral-900">
          {t(`${stepKey}.title`)}
        </h2>
        <p className="mt-1 mb-6 text-sm text-neutral-500">{t(`${stepKey}.description`)}</p>

        {/* Honeypot: off-screen, not display:none, so bots fill it and humans don't. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={form.state.website}
          onChange={(e) => form.setTop('website', e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {form.step === 1 && (
          <StepComposition
            state={form.state}
            errors={form.errors}
            setTop={form.setTop}
            setBorrowerCount={form.setBorrowerCount}
          />
        )}
        {form.step === 2 && (
          <StepPersonal
            borrowers={form.state.borrowers}
            errors={form.errors}
            onChange={form.setBorrower}
          />
        )}
        {form.step === 3 && (
          <StepProperty state={form.state} errors={form.errors} setTop={form.setTop} />
        )}
        {form.step === 4 && (
          <StepIncome
            borrowers={form.state.borrowers}
            errors={form.errors}
            onChange={form.setBorrower}
          />
        )}
        {form.step === 5 && (
          <StepStory state={form.state} errors={form.errors} setTop={form.setTop} />
        )}

        {form.submitError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {t(`errors.${SUBMIT_ERROR_KEY[form.submitError]}`)}
          </p>
        )}

        <IntakeNav
          step={form.step}
          totalSteps={form.totalSteps}
          pending={form.pending}
          onBack={form.back}
          onNext={form.next}
          onSubmit={form.submit}
        />
      </div>
    </div>
  );
}
