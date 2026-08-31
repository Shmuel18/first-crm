import type { AgreementLanguage } from './domain/agreement-text';

export type AgreementStatus = 'sent' | 'signed' | 'cancelled';

export type AgreementSignedMethod = 'digital' | 'manual';

/**
 * One engagement-agreement record (case_agreements, migrations 238/239),
 * camelCased for the UI.
 *
 * The commercial terms are the SNAPSHOT taken at send time and deliberately do
 * not follow later edits to the case. `feePercent` is the authoritative term;
 * `feeTotal` is the informational estimate that was printed alongside it.
 */
export type CaseAgreement = {
  id: string;
  caseId: string;
  status: AgreementStatus;
  signedMethod: AgreementSignedMethod | null;
  agreementVersion: string;
  language: AgreementLanguage;
  feePercent: number | null;
  feeAdvance: number;
  loanAmount: number | null;
  /** Informational estimate as printed — not the agreed sum. */
  feeTotal: number | null;
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
