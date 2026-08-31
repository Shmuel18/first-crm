'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';

import { SIGNATURE_PNG_MAX_BYTES } from '../constants';
import { isValidSignaturePng } from '../domain/validate-signature-png';
import { SubmitSignatureSchema } from '../schemas/agreement.schema';
import { mirrorAgreementToDrive } from '../services/agreement-drive.service';
import { sendAgreementSignedOfficeEmail } from '../services/agreement-email.service';
import {
  finalizeAgreementSignature,
  getAgreementForSigning,
} from '../services/agreement-signing.service';
import { hashAgreementToken } from '../services/agreement-token';

export type SubmitSignatureResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_link' | 'expired' | 'already_signed' | 'validation' | 'rate_limited' | 'unknown';
    };

/** The declared data-URL prefix is caller-controlled — verify the real bytes. */
function isPngPayload(dataUrl: string): boolean {
  const b64 = dataUrl.slice('data:image/png;base64,'.length);
  return isValidSignaturePng(Buffer.from(b64, 'base64'), SIGNATURE_PNG_MAX_BYTES);
}

/**
 * The UNAUTHENTICATED signing submission from /sign/<token>. The 256-bit
 * token is the credential; on top of it: fail-closed IP + per-token rate
 * limits (this renders a PDF — the enumeration-oracle + expensive-render
 * case), PNG magic-byte validation, and a conditional status flip inside
 * finalizeAgreementSignature so a double-submit can't overwrite evidence.
 * Drive mirror + office notification run best-effort after the response.
 */
export async function submitAgreementSignatureAction(
  input: unknown,
): Promise<SubmitSignatureResult> {
  const parsed = SubmitSignatureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { token, signaturePng } = parsed.data;

  const ip = await getRequestIp();
  const ipAllowed = await checkRateLimit({
    action: 'sign_agreement',
    subject: `ip:${ip}`,
    max: 10,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!ipAllowed) return { ok: false, error: 'rate_limited' };

  // Per-token too: an IP rotator still can't burn unlimited PDF renders against
  // one link. Keyed on the token's HASH so the counter table never holds a
  // usable credential.
  const tokenAllowed = await checkRateLimit({
    action: 'sign_agreement_token',
    subject: `token:${hashAgreementToken(token)}`,
    max: 10,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!tokenAllowed) return { ok: false, error: 'rate_limited' };

  if (!isPngPayload(signaturePng)) return { ok: false, error: 'validation' };

  const agreement = await getAgreementForSigning(token);
  if (!agreement) return { ok: false, error: 'invalid_link' };
  if (agreement.status === 'signed') return { ok: false, error: 'already_signed' };
  if (agreement.expired) return { ok: false, error: 'expired' };

  const userAgent = (await headers()).get('user-agent');
  const result = await finalizeAgreementSignature({
    agreement,
    signaturePngDataUrl: signaturePng,
    signerIp: ip,
    signerUserAgent: userAgent ? userAgent.slice(0, 400) : null,
  });
  if (!result.ok) {
    return { ok: false, error: result.error === 'conflict' ? 'already_signed' : 'unknown' };
  }

  const { caseId, agreementId, pdf, fileName } = result;
  const clientName = agreement.clientName;
  after(async () => {
    await mirrorAgreementToDrive(caseId, agreementId, { content: pdf, name: fileName });
    await sendAgreementSignedOfficeEmail({ clientName, pdf, fileName });
  });
  return { ok: true };
}
