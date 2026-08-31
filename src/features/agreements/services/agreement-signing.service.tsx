import { randomUUID } from 'node:crypto';
import { cache } from 'react';

import { renderToBuffer } from '@react-pdf/renderer';

import { createAdminClient } from '@/lib/supabase/admin';

import { AgreementPdfDocument } from '../pdf/agreement-pdf-document';
import { hashAgreementToken } from './agreement-token';

import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';
import type { Database } from '@/types/database';

const BUCKET = 'case-documents';

type AgreementRow = Database['public']['Tables']['case_agreements']['Row'];

/** What the public /sign page needs to render the agreement. */
export type AgreementForSigning = {
  id: string;
  caseId: string;
  language: AgreementLanguage;
  /** The frozen wording this client was sent; null on pre-239 rows. */
  document: AgreementDocument | null;
  clientName: string;
  clientNationalId: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  agreementVersion: string;
  status: string;
  expired: boolean;
  signedAt: string | null;
};

const SIGNING_COLUMNS =
  'id, case_id, status, agreement_version, language, text_snapshot, client_name, client_national_id, client_phone, client_email, expires_at, signed_at' as const;

/**
 * The frozen wording, or null when the row predates the snapshot column
 * (migration 239).
 *
 * Null on purpose rather than falling back to today's template: the template
 * still contains `{{feePercent}}`-style placeholders whose values live in
 * columns a pre-239 row does not have, so rendering it would either show raw
 * placeholders or invent commercial terms. Callers treat a signable row with
 * no document as unusable — which is safe, because every pre-239 row is
 * already signed (its PDF is the evidence) and every new send writes a
 * snapshot.
 */
function resolveDocument(snapshot: unknown): AgreementDocument | null {
  if (
    snapshot &&
    typeof snapshot === 'object' &&
    'title' in snapshot &&
    'preamble' in snapshot &&
    Array.isArray((snapshot as AgreementDocument).sections)
  ) {
    return snapshot as AgreementDocument;
  }
  return null;
}

/**
 * Resolve a signing link's token to its agreement row. Service-role read —
 * the signer is anonymous by design (same shape as the public intake since
 * migration 166); the 256-bit token IS the credential, and only its hash is
 * ever compared. Returns null for unknown/cancelled tokens so the page can't
 * be used to probe anything.
 *
 * React-cached so generateMetadata and the page body share ONE lookup per
 * request instead of hitting the DB twice for the same token.
 */
export const getAgreementForSigning = cache(async function getAgreementForSigning(
  token: string,
): Promise<AgreementForSigning | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('case_agreements')
    .select(SIGNING_COLUMNS)
    .eq('token_hash', hashAgreementToken(token))
    .in('status', ['sent', 'signed'])
    .maybeSingle();
  if (error) {
    console.error('[agreements] signing lookup failed', error.code);
    return null;
  }
  if (!data) return null;
  type Row = Pick<
    AgreementRow,
    | 'id'
    | 'case_id'
    | 'status'
    | 'agreement_version'
    | 'language'
    | 'text_snapshot'
    | 'client_name'
    | 'client_national_id'
    | 'client_phone'
    | 'client_email'
    | 'expires_at'
    | 'signed_at'
  >;
  // The column list is a runtime string, so supabase-js can't derive the
  // shape; Row pins it to the generated table type (same pattern as the
  // other *_COLUMNS services).
  const row = data as Row;
  const language = row.language as AgreementLanguage;
  return {
    id: row.id,
    caseId: row.case_id,
    language,
    document: resolveDocument(row.text_snapshot),
    clientName: row.client_name,
    clientNationalId: row.client_national_id,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    agreementVersion: row.agreement_version,
    status: row.status,
    expired: row.expires_at !== null && new Date(row.expires_at) < new Date(),
    signedAt: row.signed_at,
  };
});

export type FinalizeSignatureResult =
  | { ok: true; caseId: string; agreementId: string; pdf: Buffer; fileName: string }
  | { ok: false; error: 'conflict' | 'storage' | 'render_failed' };

/** Israel-wall-clock stamp printed on the PDF and shown in the office UI. */
function israelTimestamp(date: Date, language: AgreementLanguage): string {
  return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-GB', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/**
 * The signing write path: render the signed PDF, store it, and flip the row
 * to 'signed' — conditionally on it still being 'sent', so a double-submit
 * (two tabs, a retry) can't overwrite the first signature's evidence.
 */
export async function finalizeAgreementSignature(input: {
  agreement: AgreementForSigning;
  signaturePngDataUrl: string;
  signerIp: string;
  signerUserAgent: string | null;
}): Promise<FinalizeSignatureResult> {
  const { agreement } = input;
  if (!agreement.document) {
    console.error('[agreements] cannot sign a row with no text snapshot', agreement.id);
    return { ok: false, error: 'render_failed' };
  }
  const signedAt = new Date();

  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(
      <AgreementPdfDocument
        data={{
          language: agreement.language,
          document: agreement.document,
          clientName: agreement.clientName,
          clientNationalId: agreement.clientNationalId,
          clientPhone: agreement.clientPhone,
          clientEmail: agreement.clientEmail,
          signaturePngDataUrl: input.signaturePngDataUrl,
          signedAtText: israelTimestamp(signedAt, agreement.language),
          signerIp: input.signerIp,
          agreementVersion: agreement.agreementVersion,
        }}
      />,
    );
  } catch (err) {
    console.error('[agreements] pdf render failed', err);
    return { ok: false, error: 'render_failed' };
  }

  const admin = createAdminClient();
  // Unique per ATTEMPT (not per agreement): on a double-submit race the loser
  // must be able to delete its own blob without touching the winner's PDF.
  //
  // Visibility note: this lands in the case-documents bucket, whose SELECT
  // policy (migration 040) gates on view_case_documents — NOT view_collections
  // — so any advisor with document access on the case can read the PDF and
  // therefore the fee it prints, even though the case_agreements ROW is gated
  // on view_collections. That asymmetry is DELIBERATE: the office decided the
  // signed agreement is an office-wide document (it is also mirrored into the
  // case's shared Drive folder for exactly that reason). Tighten both surfaces
  // together if that decision is ever reversed — locking only one is theatre.
  const pdfPath = `${agreement.caseId}/agreements/${agreement.id}-${randomUUID()}.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });
  if (upErr) {
    console.error('[agreements] pdf upload failed', upErr);
    return { ok: false, error: 'storage' };
  }

  const { data: updated, error: updErr } = await admin
    .from('case_agreements')
    .update({
      status: 'signed',
      signed_method: 'digital',
      signed_at: signedAt.toISOString(),
      signer_ip: input.signerIp,
      signer_user_agent: input.signerUserAgent,
      signature_png: input.signaturePngDataUrl,
      pdf_path: pdfPath,
    })
    .eq('id', agreement.id)
    .eq('status', 'sent')
    .select('id');
  if (updErr) {
    console.error('[agreements] sign update failed', updErr.code);
    return { ok: false, error: 'storage' };
  }
  if (!updated || updated.length === 0) {
    // Someone beat us to it (double submit) — the first signature stands.
    await admin.storage.from(BUCKET).remove([pdfPath]).catch(() => undefined);
    return { ok: false, error: 'conflict' };
  }

  const baseName = agreement.language === 'he' ? 'הסכם התקשרות' : 'Engagement Agreement';
  return {
    ok: true,
    caseId: agreement.caseId,
    agreementId: agreement.id,
    pdf,
    fileName: `${baseName} - ${agreement.clientName}.pdf`,
  };
}
