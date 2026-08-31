'use server';

import { getTranslations } from 'next-intl/server';

import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

import { AGREEMENT_TOKEN_TTL_DAYS, AGREEMENT_VERSION } from '../constants';
import { estimatedFee } from '../domain/agreement-calc';
import { SendAgreementSchema } from '../schemas/agreement.schema';
import { sendAgreementSignRequestEmail } from '../services/agreement-email.service';
import { buildAgreementDocument } from '../services/agreement-text.service';
import { generateAgreementToken, hashAgreementToken } from '../services/agreement-token';
import { createSentAgreement, getAgreementClientSnapshot } from '../services/agreements.service';

export type SendAgreementResult =
  | { ok: true; emailStatus: 'sent' | 'skipped' | 'failed' }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'rate_limited' | 'no_borrower' | 'unknown';
    };

/**
 * Sends the engagement agreement to the client for digital signature, in the
 * chosen language: snapshots the terms, the client's identity AND the exact
 * wording onto a case_agreements row, supersedes any previous outstanding
 * link, and emails a single-use /sign/<token> URL.
 *
 * Gated on send_client_agreement (migration 239) + edit rights on the case.
 * Holding that key necessarily exposes the case's percentage and advance —
 * the document cannot be filled without them. Email delivery is reported
 * honestly so the dialog can say when nothing reached the client.
 */
export async function sendAgreementAction(input: unknown): Promise<SendAgreementResult> {
  const parsed = SendAgreementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { caseId, language, feePercent, feeAdvance, clientEmail } = parsed.data;

  const authorized =
    (await userHasPermission('send_client_agreement')) && (await userCanEditCase(caseId));
  if (!authorized) return { ok: false, error: 'unauthorized' };

  // Client-facing email — throttle per case so a client can't be spammed
  // (mirrors send-document-request).
  const allowed = await checkRateLimit({
    action: 'send_agreement',
    subject: `case:${caseId}`,
    max: 10,
    windowSeconds: 3600,
    failMode: 'open',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const snapshot = await getAgreementClientSnapshot(caseId);
  if (!snapshot) return { ok: false, error: 'no_borrower' };

  const feeEstimate = estimatedFee(snapshot.loanAmount, feePercent);
  const document = await buildAgreementDocument({
    language,
    clientName: snapshot.name,
    clientNationalId: snapshot.nationalId,
    feePercent,
    feeAdvance,
    loanAmount: snapshot.loanAmount,
  });

  const token = generateAgreementToken();
  const created = await createSentAgreement({
    caseId,
    tokenHash: hashAgreementToken(token),
    agreementVersion: AGREEMENT_VERSION,
    language,
    feePercent,
    feeAdvance,
    loanAmount: snapshot.loanAmount,
    feeEstimate,
    document,
    clientEmail,
    snapshot,
    expiresAt: new Date(Date.now() + AGREEMENT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  if (!created) return { ok: false, error: 'unknown' };

  const emailStatus = await sendAgreementSignRequestEmail({
    to: clientEmail,
    clientName: snapshot.name,
    signUrl: `${env.NEXT_PUBLIC_APP_URL}/sign/${token}`,
    language,
  });
  if (emailStatus === 'sent') {
    // NEVER log the signUrl — the token is a bearer credential and the log is
    // readable by anyone with can_view_case. Log the email's visible text.
    const tMail = await getTranslations({ locale: language, namespace: 'email.agreementSignRequest' });
    await logClientEmail({
      caseId,
      kind: 'agreement_sign_request',
      recipient: clientEmail,
      subject: tMail('subject'),
      body: tMail('intro'),
    });
  }
  return { ok: true, emailStatus };
}
