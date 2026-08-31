import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';
import type { AgreementSignedMethod, AgreementStatus, CaseAgreement } from '../types';
import type { Database, Json } from '@/types/database';

/** Mirrors the case_agreements Row fields the office UI needs. Deliberately
 *  EXCLUDES token_hash (never leaves the server), signature_png (heavy — the
 *  PDF is the viewing surface) and text_snapshot (only the /sign page and the
 *  renderer need the full wording). */
const AGREEMENT_LIST_COLUMNS =
  'id, case_id, status, signed_method, agreement_version, language, fee_percent, fee_advance, fee_total, loan_amount, client_name, client_email, sent_at, expires_at, signed_at, pdf_path, drive_file_url' as const;

type AgreementListRow = Pick<
  Database['public']['Tables']['case_agreements']['Row'],
  | 'id'
  | 'case_id'
  | 'status'
  | 'signed_method'
  | 'agreement_version'
  | 'language'
  | 'fee_percent'
  | 'fee_advance'
  | 'fee_total'
  | 'loan_amount'
  | 'client_name'
  | 'client_email'
  | 'sent_at'
  | 'expires_at'
  | 'signed_at'
  | 'pdf_path'
  | 'drive_file_url'
>;

function mapAgreementRow(row: AgreementListRow): CaseAgreement {
  return {
    id: row.id,
    caseId: row.case_id,
    // The DB CHECK constraints (migrations 238/239) are the source of these
    // unions; the generated types widen them to string.
    status: row.status as AgreementStatus,
    signedMethod: row.signed_method as AgreementSignedMethod | null,
    agreementVersion: row.agreement_version,
    language: row.language as AgreementLanguage,
    feePercent: row.fee_percent === null ? null : Number(row.fee_percent),
    feeAdvance: Number(row.fee_advance),
    feeTotal: row.fee_total === null ? null : Number(row.fee_total),
    loanAmount: row.loan_amount === null ? null : Number(row.loan_amount),
    clientName: row.client_name,
    clientEmail: row.client_email,
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    signedAt: row.signed_at,
    pdfPath: row.pdf_path,
    driveFileUrl: row.drive_file_url,
  };
}

/**
 * The case's agreement history, newest first. RLS gates reads to
 * view_collections / send_client_agreement + can_view_case; without either
 * this returns [] and the מנהלה section hides itself.
 */
export async function listCaseAgreements(caseId: string): Promise<CaseAgreement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_agreements')
    .select(AGREEMENT_LIST_COLUMNS)
    .eq('case_id', caseId)
    .order('sent_at', { ascending: false })
    .limit(10);
  if (error) {
    console.error('[agreements] list failed (migrations 238/239 applied?)', error.code);
    return [];
  }
  return (data ?? []).map(mapAgreementRow);
}

export type CreateSentAgreementInput = {
  caseId: string;
  tokenHash: string;
  agreementVersion: string;
  language: AgreementLanguage;
  feePercent: number;
  feeAdvance: number;
  loanAmount: number | null;
  feeEstimate: number | null;
  document: AgreementDocument;
  clientEmail: string;
  snapshot: AgreementClientSnapshot;
  expiresAt: Date;
};

/**
 * Supersede any outstanding link on the case, then insert the new 'sent' row.
 * Runs on the user client so the migration-239 RLS (send_client_agreement +
 * can_edit_case) stays the write gate. Returns the new row id, or null.
 */
export async function createSentAgreement(input: CreateSentAgreementInput): Promise<string | null> {
  const supabase = await createClient();
  // A case holds at most one live link (partial unique index) — supersede the
  // previous send before inserting.
  await supabase
    .from('case_agreements')
    .update({ status: 'cancelled' })
    .eq('case_id', input.caseId)
    .eq('status', 'sent');

  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('case_agreements')
    .insert({
      case_id: input.caseId,
      status: 'sent',
      token_hash: input.tokenHash,
      agreement_version: input.agreementVersion,
      language: input.language,
      fee_percent: input.feePercent,
      fee_advance: input.feeAdvance,
      loan_amount: input.loanAmount,
      fee_total: input.feeEstimate,
      // The exact wording this client was shown — frozen against later edits
      // of the office template.
      text_snapshot: input.document as unknown as Json,
      client_name: input.snapshot.name,
      client_national_id: input.snapshot.nationalId,
      client_phone: input.snapshot.phone,
      client_email: input.clientEmail,
      sent_by: userRes.user?.id ?? null,
      expires_at: input.expiresAt.toISOString(),
    })
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('[agreements] insert failed', error?.code);
    return null;
  }
  return data.id;
}

export type AgreementClientSnapshot = {
  name: string;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  /** cases.requested_mortgage_amount — the basis for the printed estimate. */
  loanAmount: number | null;
};

/**
 * The primary borrower's identity as it will be PRINTED on the agreement, plus
 * the loan figure the fee estimate is computed from. Read with the user client
 * so case/borrower RLS stays the access gate.
 */
export async function getAgreementClientSnapshot(
  caseId: string,
): Promise<AgreementClientSnapshot | null> {
  const supabase = await createClient();
  const { data: caseRow } = await supabase
    .from('cases')
    .select('primary_borrower_id, requested_mortgage_amount')
    .eq('id', caseId)
    .maybeSingle();
  const borrowerId = caseRow?.primary_borrower_id;
  if (!borrowerId) return null;

  const { data: borrower } = await supabase
    .from('borrowers')
    .select('first_name, last_name, national_id, phone, email')
    .eq('id', borrowerId)
    .maybeSingle();
  if (!borrower) return null;

  const name = formatPersonName(borrower.first_name, borrower.last_name);
  if (!name) return null;
  return {
    name,
    nationalId: borrower.national_id?.trim() || null,
    phone: borrower.phone?.trim() || null,
    email: borrower.email?.trim() || null,
    loanAmount:
      caseRow?.requested_mortgage_amount == null
        ? null
        : Number(caseRow.requested_mortgage_amount),
  };
}
