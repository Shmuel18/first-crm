import { Resend } from 'resend';

import { env } from '@/lib/env';
import { withTimeout } from '@/lib/http/with-timeout';

export type SendEmailResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true } // not configured — intentional no-op
  | { ok: false; error: string };

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Lets the recipient hit Reply and reach a real inbox (e.g. the office). */
  replyTo?: string;
};

/**
 * Sends an email via Resend. If email is not configured (no RESEND_API_KEY /
 * EMAIL_FROM), it returns a successful "skipped" result rather than throwing,
 * so callers can stay agnostic — the feature simply degrades to in-app only.
 *
 * Never throws: email is always best-effort and must not break the action
 * that triggered it.
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  // Narrowing both here (rather than trusting isEmailConfigured) removes the
  // need for non-null assertions below.
  if (!apiKey || !from) {
    return { ok: true, skipped: true };
  }

  try {
    const resend = new Resend(apiKey);
    // Resend's SDK doesn't expose AbortSignal — wrap with a hard deadline
    // so a slow Resend call can't hold a Vercel function indefinitely.
    const { error } = await withTimeout(
      resend.emails.send({ from, to, subject, html, replyTo }),
      10_000,
      'resend_timeout',
    );

    if (error) {
      console.error('[sendEmail] resend error', { name: error.name });
      return { ok: false, error: 'send_failed' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[sendEmail] threw', { message: err instanceof Error ? err.message : 'unknown' });
    return { ok: false, error: 'send_failed' };
  }
}
