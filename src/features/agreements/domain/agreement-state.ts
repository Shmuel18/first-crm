import type { AgreementState, CaseAgreement } from '../types';

/**
 * Derive the section's display state from the case's agreement rows (newest
 * first). The LATEST non-cancelled row decides: a re-send supersedes an older
 * signed record, and cancelled rows are history only.
 */
export function resolveAgreementState(
  rows: ReadonlyArray<CaseAgreement>,
  now: Date,
): AgreementState {
  const current = rows.find((r) => r.status !== 'cancelled');
  if (!current) return { kind: 'none' };
  if (current.status === 'signed') return { kind: 'signed', agreement: current };
  const expired = current.expiresAt !== null && new Date(current.expiresAt) < now;
  return { kind: 'sent', agreement: current, expired };
}
