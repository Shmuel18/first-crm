import type { CaseAgreement } from '../types';

/**
 * Skeleton row for optimistic UI transitions — the debounced router.refresh
 * replaces it with the real DB row moments later. The placeholder id is
 * deliberately non-UUID so a stale click can't address a real record.
 */
export function optimisticAgreement(caseId: string): CaseAgreement {
  return {
    id: `optimistic-${caseId}`,
    caseId,
    status: 'sent',
    signedMethod: null,
    agreementVersion: '',
    feeTotal: 0,
    feeAdvance: 0,
    clientName: '',
    clientEmail: null,
    sentAt: new Date().toISOString(),
    expiresAt: null,
    signedAt: null,
    pdfPath: null,
    driveFileUrl: null,
  };
}
