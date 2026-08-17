/**
 * Who signs the bank summary PDF (office_settings.bank_pdf_signature_mode,
 * migration 228).
 *
 * The bank relationship belongs to the office, not to the individual advisor —
 * so 'office' is the default and 'advisor' (the old hardcoded behaviour) is now
 * an opt-in. 'none' prints a bare signature line for a hand-signed submission.
 */
export const BANK_PDF_SIGNATURE_MODES = ['office', 'advisor', 'none'] as const;

export type BankPdfSignatureMode = (typeof BANK_PDF_SIGNATURE_MODES)[number];

/** Fallback for an unreadable / not-yet-migrated setting. */
export const DEFAULT_BANK_PDF_SIGNATURE_MODE: BankPdfSignatureMode = 'office';

export function isBankPdfSignatureMode(value: unknown): value is BankPdfSignatureMode {
  return BANK_PDF_SIGNATURE_MODES.includes(value as BankPdfSignatureMode);
}

/** A name + contact details the PDF may print. Any part may be missing. */
export type SignatureParty = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type BankPdfSignature = {
  /** Printed under the signature line. null → blank line, no name. */
  name: string | null;
  /** "phone · email" (whichever exists). null → no contact row. */
  contact: string | null;
  /** Whether the cover meta strip may name the case's advisor. */
  showAdvisorOnCover: boolean;
};

const EMPTY: BankPdfSignature = { name: null, contact: null, showAdvisorOnCover: false };

function contactLine(party: SignatureParty): string | null {
  const parts = [party.phone, party.email].filter((v): v is string => Boolean(v?.trim()));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Pure resolution of the printed signature. 'none' also strips the advisor from
 * the cover meta strip — otherwise "no signature" would still name the advisor
 * one page earlier, which is precisely what the setting exists to prevent.
 */
export function resolveBankPdfSignature(
  mode: BankPdfSignatureMode,
  advisor: SignatureParty,
  office: SignatureParty,
): BankPdfSignature {
  if (mode === 'none') return EMPTY;
  if (mode === 'advisor') {
    return { name: advisor.name, contact: contactLine(advisor), showAdvisorOnCover: true };
  }
  return { name: office.name, contact: contactLine(office), showAdvisorOnCover: false };
}
