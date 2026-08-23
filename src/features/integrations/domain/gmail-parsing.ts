/**
 * Pure Gmail payload parsing (no I/O) — unit-tested against the shapes the
 * Gmail API returns for `format=full` messages. Used by the mail-intake
 * pipeline (ai-v2-spec.md §3).
 */

export type GmailHeader = { name: string; value: string };

export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

export type GmailAttachmentMeta = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  attachmentId: string;
  /** Inline images (signatures/logos) — filtered out of document ingestion. */
  isInline: boolean;
};

export function getHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? null;
}

/** "משה לוי <moshe@gmail.com>" → { name: 'משה לוי', email: 'moshe@gmail.com' } */
export function parseFromHeader(value: string | null): { email: string; name: string | null } {
  if (!value) return { email: '', name: null };
  const angled = value.match(/^\s*"?(.*?)"?\s*<([^>]+)>\s*$/);
  if (angled) {
    const email = angled[2]!.trim().toLowerCase();
    const name = angled[1]!.trim();
    return { email, name: name.length > 0 ? name : null };
  }
  return { email: value.trim().toLowerCase(), name: null };
}

/** Gmail uses base64url with optional padding. */
export function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBodyPart(part: GmailPart, wanted: string): GmailPart | null {
  if (part.mimeType === wanted && part.body?.data && !part.filename) return part;
  for (const child of part.parts ?? []) {
    const found = findBodyPart(child, wanted);
    if (found) return found;
  }
  return null;
}

/**
 * Best-effort text body: prefer text/plain, fall back to de-tagged text/html.
 * Capped — the triage model needs an excerpt, never the whole thread.
 */
export function extractTextBody(payload: GmailPart, maxChars: number): string {
  const plain = findBodyPart(payload, 'text/plain');
  if (plain?.body?.data) {
    return decodeBase64Url(plain.body.data).toString('utf8').trim().slice(0, maxChars);
  }
  const html = findBodyPart(payload, 'text/html');
  if (html?.body?.data) {
    return stripHtml(decodeBase64Url(html.body.data).toString('utf8')).slice(0, maxChars);
  }
  return '';
}

/** Inline threshold: tiny images are signatures/logos, not documents. */
const INLINE_IMAGE_MAX_BYTES = 50 * 1024;

export function collectAttachments(payload: GmailPart): GmailAttachmentMeta[] {
  const out: GmailAttachmentMeta[] = [];
  const walk = (part: GmailPart): void => {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      const contentId = getHeader(part.headers, 'Content-ID');
      const disposition = getHeader(part.headers, 'Content-Disposition') ?? '';
      const sizeBytes = part.body.size ?? 0;
      const isImage = (part.mimeType ?? '').startsWith('image/');
      out.push({
        filename: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        sizeBytes,
        attachmentId: part.body.attachmentId,
        isInline:
          Boolean(contentId) ||
          /^inline/i.test(disposition) ||
          (isImage && sizeBytes > 0 && sizeBytes < INLINE_IMAGE_MAX_BYTES),
      });
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  return out;
}
