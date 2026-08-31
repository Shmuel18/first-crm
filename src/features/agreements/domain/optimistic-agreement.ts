import type { AgreementLanguage } from './agreement-text';
import type { CaseAgreement } from '../types';

/**
 * Skeleton row for optimistic UI transitions — the debounced router.refresh
 * replaces it with the real DB row moments later. The placeholder id is
 * deliberately non-UUID so a stale click can't address a real record.
 */
export function optimisticAgreement(caseId: string, language: AgreementLanguage = 'he'): CaseAgreement {
  return {
    id: `optimistic-${caseId}`,
    caseId,
    status: 'sent',
    signedMethod: null,
    agreementVersion: '',
    language,
    feePercent: null,
    feeAdvance: 0,
    loanAmount: null,
    feeTotal: null,
    clientName: '',
    clientEmail: null,
    sentAt: new Date().toISOString(),
    expiresAt: null,
    signedAt: null,
    pdfPath: null,
    driveFileUrl: null,
  };
}
