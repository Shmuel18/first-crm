import { normalizeIsraeliPhone } from '@/lib/validators/il-phone';

/**
 * Borrower contact-link builders.
 *
 * All return `null` when the source value isn't useful (missing or invalid),
 * so the UI can simply skip rendering the icon — no defensive checks at the
 * call site.
 */

/**
 * wa.me URL for an Israeli phone. WhatsApp expects international format with
 * no leading "+", so a local "0501234567" becomes "972501234567". When
 * `text` is provided it's appended as a URL-encoded `?text=...` query —
 * WhatsApp pre-fills the composer with that message so the advisor only
 * has to hit send.
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  text?: string | null,
): string | null {
  if (!phone) return null;
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return null;
  const base = `https://wa.me/972${normalized.slice(1)}`;
  const trimmed = text?.trim();
  return trimmed ? `${base}?text=${encodeURIComponent(trimmed)}` : base;
}

/** tel: link. Returns null for empty/invalid input. */
export function buildTelLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return null;
  return `tel:${normalized}`;
}

/** mailto: link. Returns null for empty input — does not validate format. */
export function buildMailLink(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  return trimmed ? `mailto:${trimmed}` : null;
}
