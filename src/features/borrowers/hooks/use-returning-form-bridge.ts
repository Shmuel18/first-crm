'use client';

import { useState, type FormEvent, type RefObject } from 'react';

import {
  pickReturningFields,
  RETURNING_FILL_FIELDS,
  RETURNING_OVERWRITE_CLASS,
  returningOverwrittenFields,
  type ReturningFillField,
} from '../domain/returning-autofill-fields';

import type { ReturningBorrowerMatch, ReturningProbe } from '../types';

const EMPTY_PROBE: ReturningProbe = { firstName: '', lastName: '', nationalId: '', phone: '' };
const OVERWRITE_CLASSES = RETURNING_OVERWRITE_CLASS.split(' ');

type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Bridges the auto-detect autofill to the UNCONTROLLED BorrowerForm. Reads the
 * probe straight off the form DOM on blur, writes an accepted match back into
 * the fields, and amber-rings any field whose typed value got overwritten
 * (cleared the moment the user edits that field again).
 */
export function useReturningFormBridge(formRef: RefObject<HTMLFormElement | null>) {
  const [probe, setProbe] = useState<ReturningProbe>(EMPTY_PROBE);

  const field = (name: string): FormElement | null => {
    const el = formRef.current?.elements.namedItem(name);
    return el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
      ? el
      : null;
  };

  const refreshProbe = (): void => {
    setProbe({
      firstName: field('first_name')?.value ?? '',
      lastName: field('last_name')?.value ?? '',
      nationalId: field('national_id')?.value ?? '',
      phone: field('phone')?.value ?? '',
    });
  };

  const onFill = (match: ReturningBorrowerMatch): void => {
    const picked = pickReturningFields(match);
    const before: Partial<Record<ReturningFillField, string>> = {};
    for (const name of RETURNING_FILL_FIELDS) {
      before[name] = field(name)?.value ?? '';
    }
    const overwritten = new Set(returningOverwrittenFields(before, picked));
    for (const name of RETURNING_FILL_FIELDS) {
      const el = field(name);
      if (!el) continue;
      el.value = picked[name];
      if (overwritten.has(name)) el.classList.add(...OVERWRITE_CLASSES);
    }
  };

  // Clear the amber ring as soon as the user edits a flagged field.
  const clearMark = (e: FormEvent): void => {
    if (e.target instanceof HTMLElement) e.target.classList.remove(...OVERWRITE_CLASSES);
  };

  return { probe, refreshProbe, onFill, clearMark };
}
