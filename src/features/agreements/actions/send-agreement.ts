'use server';

import { getTranslations } from 'next-intl/server';

import { logClientEmail } from '@/features/case-activity/services/client-email-log.service';
import { userCanEditCase, userHasAllPermissions } from '@/lib/auth/permissions';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

import { AGREEMENT_TOKEN_TTL_DAYS, AGREEMENT_VERSION } from '../constants';
import { SendAgreementSchema } from '../schemas/agreement.schema';
import { sendAgreementSignRequestEmail } from '../services/agreement-email.service';
import { generateAgreementToken, hashAgreementToken } from '../services/agreement-token';
import { createSentAgreement, getAgreementClientSnapshot } from '../services/agreements.service';

export type SendAgreementResult =
  | { ok: true; emailStatus: 'sent' | 'skipped' | 'failed' }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'rate_limited' | 'no_borrower' | 'unknown';
    };

/**
 * Sends the engagement agreement to the client for digital signature:
 * snapshots the fee + client identity onto a case_agreements row, cancels any
 * previous outstanding link, and emails a single-use /sign/<token> URL.
 * Requires manage_collections + view_case_fee (the dialog shows the amounts)
 * + edit rights on the case. Email delivery is reported honestly so the
 * dialog can tell the manager when nothing reached the client.
 */
export async function sendAgreementAction(input: unknown): Promise<SendAgreementResult> {
  const parsed = SendAgreementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { caseId, feeTotal, feeAdvance, clientEmail } = parsed.data;

  const authorized =
    (await userHasAllPermissions('manage_collections', 'view_case_fee')) &&
    (await userCanEditCase(caseId));
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

  const token = generateAgreementToken();
  const created = await createSentAgreement({
    caseId,
    tokenHash: hashAgreementToken(token),
    agreementVersion: AGREEMENT_VERSION,
    feeTotal,
    feeAdvance,
    clientEmail,
    snapshot,
    expiresAt: new Date(Date.now() + AGREEMENT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  if (!created) return { ok: false, error: 'unknown' };

  const signUrl = `${env.NEXT_PUBLIC_APP_URL}/sign/${token}`;
  const emailStatus = await sendAgreementSignRequestEmail({
    to: clientEmail,
    clientName: snapshot.name,
    signUrl,
  });
  if (emailStatus === 'sent') {
    // NEVER log the signUrl — the token is a bearer credential and the log is
    // readable by anyone with can_view_case. Log the email's visible text.
    const tMail = await getTranslations({ locale: 'he', namespace: 'email.agreementSignRequest' });
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
