import { NextResponse } from 'next/server';

import { WebContactSchema } from '@/features/intake/schemas/intake.schema';
import { createIntakeLead } from '@/features/intake/services/create-intake-lead';

import type { IntakeInput } from '@/features/intake/schemas/intake.schema';

/**
 * Public, UNAUTHENTICATED lead intake for the marketing landing page
 * (kaufman-finance.com). No user auth by design — same posture as /check. Since
 * migration 166 the submit_public_intake RPC is service_role-only, so the
 * landing can no longer reach the DB with the public key; this server-side route
 * is its only write path. Defenses: a honeypot, a timing trap, Zod validation,
 * and createIntakeLead's fail-closed IP + email rate-limit. CORS is restricted
 * to the landing origin.
 */

const ALLOWED_ORIGIN = 'https://kaufman-finance.com';
const MAX_BODY_CHARS = 16_384;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function isAllowedOrigin(request: Request): boolean {
  return request.headers.get('origin') === ALLOWED_ORIGIN;
}

function json(body: unknown, status: number): Response {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request): Promise<Response> {
  // CORS controls browser response access, not whether the server processes the
  // request. Refuse other/missing origins too. A non-browser client can spoof
  // Origin, so the rate-limit remains the load-bearing abuse defense.
  if (!isAllowedOrigin(request)) return json({ ok: false }, 403);

  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return json({ ok: false }, 415);

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARS) {
    return json({ ok: false }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return json({ ok: false }, 413);
    const raw: unknown = JSON.parse(text);
    body = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  } catch {
    return json({ ok: false }, 400);
  }

  // Honeypot: a hidden field no human fills. Ack success and drop, like /check.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return json({ ok: true }, 200);
  }
  // Timing trap: a sub-2.5s fill is a script. The browser also drops these, but
  // the server must not trust the client.
  if (typeof body.elapsed_ms === 'number' && body.elapsed_ms >= 0 && body.elapsed_ms < 2500) {
    return json({ ok: true }, 200);
  }

  const parsed = WebContactSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false }, 400);
  }

  const { name, email, subject, message, locale } = parsed.data;
  const [first, ...rest] = name.split(/\s+/).filter(Boolean);
  const tag = locale === 'he' ? 'פנייה מטופס יצירת קשר באתר' : 'Website contact form';
  const details = `[${tag}] ${subject ? `${subject} — ` : ''}${message ?? ''}`.trim();

  // Map the contact shape onto one borrower; the rest of the questionnaire is
  // absent (legitimately) so the RPC stores NULLs. The RPC requires first_name +
  // a phone or email — both satisfied.
  const payload: IntakeInput = {
    borrowers: [{ first_name: first ?? name, last_name: rest.join(' '), email }],
    request_details: details,
    locale,
    consent: true,
  };

  const result = await createIntakeLead(payload, locale, 'web_contact');
  if (!result.ok) {
    return json({ ok: false }, result.error === 'rate_limited' ? 429 : 502);
  }
  return json({ ok: true }, 200);
}
