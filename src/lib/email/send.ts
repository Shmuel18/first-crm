import { Resend } from 'resend';

import { env } from '@/lib/env';

export type SendEmailResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true } // not configured — intentional no-op
  | { ok: false; error: string };

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Sends an email via Resend. If email is not configured (no RESEND_API_KEY /
 * EMAIL_FROM), it returns a successful "skipped" result rather than throwing,
 * so callers can stay agnostic — the feature simply degrades to in-app only.
 *
 * Never throws: email is always best-effort and must not break the action
 * that triggered it.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  // Narrowing both here (rather than trusting isEmailConfigured) removes the
  // need for non-null assertions below.
  if (!apiKey || !from) {
    return { ok: true, skipped: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to, subject, html });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
