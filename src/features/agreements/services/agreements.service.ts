import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

import type { AgreementSignedMethod, AgreementStatus, CaseAgreement } from '../types';
import type { Database } from '@/types/database';

/** Mirrors the case_agreements Row fields the office UI needs. Deliberately
 *  EXCLUDES token_hash (never leaves the server) and signature_png (heavy;
 *  the PDF is the viewing surface). */
const AGREEMENT_LIST_COLUMNS =
  'id, case_id, status, signed_method, agreement_version, fee_total, fee_advance, client_name, client_email, sent_at, expires_at, signed_at, pdf_path, drive_file_url' as const;

type AgreementListRow = Pick<
  Database['public']['Tables']['case_agreements']['Row'],
  | 'id'
  | 'case_id'
  | 'status'
  | 'signed_method'
  | 'agreement_version'
  | 'fee_total'
  | 'fee_advance'
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
    // The DB CHECK constraints (migration 238) are the source of these unions;
    // the generated types widen them to string.
    status: row.status as AgreementStatus,
    signedMethod: row.signed_method as AgreementSignedMethod | null,
    agreementVersion: row.agreement_version,
    feeTotal: Number(row.fee_total),
    feeAdvance: Number(row.fee_advance),
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
 * view_collections + can_view_case; without them this returns [] and the
 * מנהלה section hides itself.
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
    console.error('[agreements] list failed (migration 238 applied?)', error.code);
    return [];
  }
  return (data ?? []).map(mapAgreementRow);
}

export type CreateSentAgreementInput = {
  caseId: string;
  tokenHash: string;
  agreementVersion: string;
  feeTotal: number;
  feeAdvance: number;
  clientEmail: string;
  snapshot: AgreementClientSnapshot;
  expiresAt: Date;
};

/**
 * Cancel any outstanding link on the case, then insert the new 'sent' row.
 * Runs on the user client so the migration-238 RLS (manage_collections +
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
      fee_total: input.feeTotal,
      fee_advance: input.feeAdvance,
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
};

/**
 * The primary borrower's identity as it will be PRINTED on the agreement.
 * Read with the user client so case/borrower RLS stays the access gate.
 */
export async function getAgreementClientSnapshot(
  caseId: string,
): Promise<AgreementClientSnapshot | null> {
  const supabase = await createClient();
  const { data: caseRow } = await supabase
    .from('cases')
    .select('primary_borrower_id')
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
  };
}
