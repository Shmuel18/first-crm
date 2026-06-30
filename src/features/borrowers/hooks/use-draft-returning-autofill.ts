'use client';

import { useState } from 'react';

import {
  pickReturningFields,
  RETURNING_OVERWRITE_CLASS,
  returningOverwrittenFields,
  type ReturningFillField,
  type ReturningSnapshotChoice,
} from '../domain/returning-autofill-fields';

import type { ReturningBorrowerMatch, ReturningProbe } from '../types';

type CurrentValues = Partial<Record<ReturningFillField, unknown>>;

function asProbeString(value: unknown): string {
  return value == null ? '' : String(value);
}

/**
 * Returning-client autofill wiring for the CONTROLLED DraftBorrowerCard. Derives
 * the probe from the card's current values, and on import computes which typed
 * fields get overwritten (→ amber ring via markClass) before handing the raw
 * match to `applyMatch` for the card to merge into its state. markClass clears
 * per-field as soon as the user re-edits that field (call clearMark in saveField).
 */
export function useDraftReturningAutofill(
  current: CurrentValues,
  applyMatch: (match: ReturningBorrowerMatch, snapshot?: ReturningSnapshotChoice) => void,
) {
  const [overwritten, setOverwritten] = useState<ReadonlySet<ReturningFillField>>(new Set());

  const probe: ReturningProbe = {
    firstName: asProbeString(current.first_name),
    lastName: asProbeString(current.last_name),
    nationalId: asProbeString(current.national_id),
    phone: asProbeString(current.phone),
  };

  const onFill = (match: ReturningBorrowerMatch, snapshot?: ReturningSnapshotChoice): void => {
    setOverwritten(new Set(returningOverwrittenFields(current, pickReturningFields(match))));
    applyMatch(match, snapshot);
  };

  const markClass = (field: ReturningFillField): string | undefined =>
    overwritten.has(field) ? RETURNING_OVERWRITE_CLASS : undefined;

  const clearMark = (field: string): void => {
    setOverwritten((prev) => {
      if (!prev.has(field as ReturningFillField)) return prev;
      const next = new Set(prev);
      next.delete(field as ReturningFillField);
      return next;
    });
  };

  return { probe, onFill, markClass, clearMark };
}
