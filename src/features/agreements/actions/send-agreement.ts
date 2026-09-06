'use server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

import { AGREEMENT_TOKEN_TTL_DAYS, AGREEMENT_VERSION } from '../constants';
import { printedFeeAmount, type AgreementFeeTerms } from '../domain/agreement-calc';
import { SendAgreementSchema } from '../schemas/agreement.schema';
import { sendAndLogSignRequest } from '../services/agreement-email.service';
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
 * The fee is agreed either as a percentage of the loan or as a flat sum; the
 * document prints a different clause for each (domain/agreement-fee-sentences).
 *
 * Gated on send_client_agreement (migration 239) + edit rights on the case.
 * Holding that key necessarily exposes the case's percentage and advance —
 * the document cannot be filled without them. Email delivery is reported
 * honestly so the dialog can say when nothing reached the client.
 */
export async function sendAgreementAction(input: unknown): Promise<SendAgreementResult> {
  const parsed = SendAgreementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { caseId, language, feeAdvance, clientEmail } = parsed.data;
  const fee: AgreementFeeTerms =
    parsed.data.feeBasis === 'percent'
      ? { basis: 'percent', feePercent: parsed.data.feePercent }
      : { basis: 'fixed', feeAmount: parsed.data.feeAmount };

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

  // For a percentage deal this is the printed ESTIMATE; for a fixed fee it is
  // the agreed sum itself (fee_percent then stays null — migration 246).
  const feeTotal = printedFeeAmount(fee, snapshot.loanAmount);
  const document = await buildAgreementDocument({
    language,
    clientName: snapshot.name,
    clientNationalId: snapshot.nationalId,
    fee,
    feeAdvance,
    loanAmount: snapshot.loanAmount,
  });

  const token = generateAgreementToken();
  const created = await createSentAgreement({
    caseId,
    tokenHash: hashAgreementToken(token),
    agreementVersion: AGREEMENT_VERSION,
    language,
    feePercent: fee.basis === 'percent' ? fee.feePercent : null,
    feeAdvance,
    loanAmount: snapshot.loanAmount,
    feeTotal,
    document,
    clientEmail,
    snapshot,
    expiresAt: new Date(Date.now() + AGREEMENT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  if (!created) return { ok: false, error: 'unknown' };

  const emailStatus = await sendAndLogSignRequest({
    caseId,
    to: clientEmail,
    clientName: snapshot.name,
    signUrl: `${env.NEXT_PUBLIC_APP_URL}/sign/${token}`,
    language,
  });
  return { ok: true, emailStatus };
}
