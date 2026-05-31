/**
 * Pure decision: given the values typed so far, which single axis (if any) do
 * we search a returning client by? Shared between the server action (the
 * authoritative call) and the client hook (to build a dedup key and to know
 * whether a search is even warranted). Keeping it here means the priority
 * order and thresholds can't drift between client and server.
 */
import { normalizeIsraeliPhone } from '@/lib/validators/il-phone';

import type { ReturningProbe } from '../types';

// Minimum input length before a criterion is "ready" — avoids searching on a
// half-typed value and keeps early keystrokes from firing lookups.
const NAME_MIN = 2;
const NATIONAL_ID_MIN = 6;

export type ReturningCriteria =
  | { by: 'nationalId'; value: string }
  | { by: 'phone'; value: string }
  | { by: 'name'; firstName: string; lastName: string };

/**
 * Most specific available axis wins: national_id (exact, unique) > phone
 * (exact, normalized) > full name (partial). Null when nothing clears its
 * threshold.
 */
export function chooseReturningCriteria(probe: ReturningProbe): ReturningCriteria | null {
  const nationalId = probe.nationalId?.trim() ?? '';
  if (nationalId.length >= NATIONAL_ID_MIN) {
    return { by: 'nationalId', value: nationalId };
  }

  const phone = probe.phone ? normalizeIsraeliPhone(probe.phone) : null;
  if (phone) {
    return { by: 'phone', value: phone };
  }

  const firstName = probe.firstName?.trim() ?? '';
  const lastName = probe.lastName?.trim() ?? '';
  if (firstName.length >= NAME_MIN && lastName.length >= NAME_MIN) {
    return { by: 'name', firstName, lastName };
  }

  return null;
}

/** Stable key for "have we already searched this exact value?" dedup. */
export function criteriaKey(criteria: ReturningCriteria): string {
  return criteria.by === 'name'
    ? `name:${criteria.firstName}|${criteria.lastName}`
    : `${criteria.by}:${criteria.value}`;
}
