'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';

import { SIGNATURE_PNG_MAX_BYTES } from '../constants';
import { SubmitSignatureSchema } from '../schemas/agreement.schema';
import { mirrorAgreementToDrive } from '../services/agreement-drive.service';
import { sendAgreementSignedOfficeEmail } from '../services/agreement-email.service';
import {
  finalizeAgreementSignature,
  getAgreementForSigning,
} from '../services/agreement-signing.service';

export type SubmitSignatureResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_link' | 'expired' | 'already_signed' | 'validation' | 'rate_limited' | 'unknown';
    };

/** PNG magic bytes — the declared data-URL prefix is caller-controlled. */
function isPngPayload(dataUrl: string): boolean {
  const b64 = dataUrl.slice('data:image/png;base64,'.length);
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 8 || buf.length > SIGNATURE_PNG_MAX_BYTES) return false;
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
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
