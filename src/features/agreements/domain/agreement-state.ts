import type { AgreementState, CaseAgreement } from '../types';

/**
 * Derive the section's display state from the case's agreement rows (newest
 * first). Only the NEWEST row counts.
 *
 * Deliberately not "the newest non-cancelled row": voiding a signed agreement
 * (the office found a mistake and wants to re-send) would then fall through to
 * an OLDER signed row and present that stale document as the one in force —
 * exactly the wrong answer at exactly the wrong moment. A cancelled newest row
 * means "nothing is in force", which is what the office just asked for.
 */
export function resolveAgreementState(
  rows: ReadonlyArray<CaseAgreement>,
  now: Date,
): AgreementState {
  const current = rows[0];
  if (!current || current.status === 'cancelled') return { kind: 'none' };
  if (current.status === 'signed') return { kind: 'signed', agreement: current };
  const expired = current.expiresAt !== null && new Date(current.expiresAt) < now;
  return { kind: 'sent', agreement: current, expired };
}
