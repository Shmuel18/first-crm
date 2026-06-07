'use client';

import { parseAsInteger, useQueryState } from 'nuqs';
import { useCallback, useState, useTransition } from 'react';

import { submitIntakeAction } from './actions/submit-intake';
import {
  emptyBorrower,
  emptyIntakeState,
  stepForErrorKey,
  toIntakePayload,
  type BorrowerDraft,
  type IntakeFormState,
} from './form-state';
import type { IntakeFieldErrors } from './types';

export const TOTAL_STEPS = 5;

type Texts = { consentRequired: string; contactRequired: string };

/** Drives the public intake wizard: draft state, URL-synced step, submission. */
export function useIntakeForm(locale: string, texts: Texts) {
  const [rawStep, setRawStep] = useQueryState('step', parseAsInteger.withDefault(1));
  const [state, setState] = useState<IntakeFormState>(() => emptyIntakeState(locale));
  const [errors, setErrors] = useState<IntakeFieldErrors>({});
  const [submitError, setSubmitError] = useState<'rate_limited' | 'unknown' | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const step = Math.min(TOTAL_STEPS, Math.max(1, rawStep));

  const goTo = useCallback(
    (n: number) => {
      void setRawStep(Math.min(TOTAL_STEPS, Math.max(1, n)));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setRawStep],
  );
  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => goTo(step - 1), [goTo, step]);

  const setTop = useCallback(
    <K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) =>
      setState((s) => ({ ...s, [key]: value })),
    [],
  );

  const setBorrower = useCallback(
    (index: number, key: keyof BorrowerDraft, value: string) =>
      setState((s) => ({
        ...s,
        borrowers: s.borrowers.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
      })),
    [],
  );

  const setBorrowerCount = useCallback((count: number) => {
    const n = Math.min(4, Math.max(1, count));
    setState((s) => {
      if (n === s.borrowers.length) return s;
      if (n < s.borrowers.length) return { ...s, borrowers: s.borrowers.slice(0, n) };
      const extra = Array.from({ length: n - s.borrowers.length }, emptyBorrower);
      return { ...s, borrowers: [...s.borrowers, ...extra] };
    });
  }, []);

  const showErrors = useCallback(
    (fieldErrors: IntakeFieldErrors) => {
      setErrors(fieldErrors);
      const firstStep = Object.keys(fieldErrors)
        .map(stepForErrorKey)
        .sort((a, b) => a - b)[0];
      if (firstStep) goTo(firstStep);
    },
    [goTo],
  );

  const submit = useCallback(() => {
    setSubmitError(null);
    // Cheap client guards for the two cross-field rules, so the user isn't sent
    // to the server just to learn the consent box is unchecked.
    const pre: IntakeFieldErrors = {};
    if (!state.consent) pre['consent'] = texts.consentRequired;
    const primary = state.borrowers[0];
    if (primary && !primary.phone.trim() && !primary.email.trim()) {
      pre['borrowers.0.phone'] = texts.contactRequired;
    }
    if (Object.keys(pre).length > 0) {
      showErrors(pre);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await submitIntakeAction(toIntakePayload(state, locale));
      if (result.ok) {
        setDone(true);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
        return;
      }
      if (result.error === 'validation') {
        showErrors(result.fieldErrors);
        return;
      }
      setSubmitError(result.error);
    });
  }, [state, locale, texts, showErrors]);

  return {
    step,
    totalSteps: TOTAL_STEPS,
    state,
    errors,
    submitError,
    done,
    pending,
    goTo,
    next,
    back,
    setTop,
    setBorrower,
    setBorrowerCount,
    submit,
  };
}
