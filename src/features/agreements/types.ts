export type AgreementStatus = 'sent' | 'signed' | 'cancelled';

export type AgreementSignedMethod = 'digital' | 'manual';

/**
 * One engagement-agreement record (case_agreements, migration 238), camelCased
 * for the UI. The fee + client fields are the SNAPSHOT taken at send time —
 * they deliberately do not follow later edits to case_financials/borrowers.
 */
export type CaseAgreement = {
  id: string;
  caseId: string;
  status: AgreementStatus;
  signedMethod: AgreementSignedMethod | null;
  agreementVersion: string;
  feeTotal: number;
  feeAdvance: number;
  clientName: string;
  clientEmail: string | null;
  sentAt: string;
  expiresAt: string | null;
  signedAt: string | null;
  pdfPath: string | null;
  driveFileUrl: string | null;
};

/** What the מנהלה section shows: the latest non-cancelled row decides. */
export type AgreementState =
  | { kind: 'none' }
  | { kind: 'sent'; agreement: CaseAgreement; expired: boolean }
  | { kind: 'signed'; agreement: CaseAgreement };
