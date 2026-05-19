import DOMPurify from 'isomorphic-dompurify';

import { RICH_TEXT_ALLOWED_TAGS } from '@/lib/constants/sanitize';

/**
 * Sanitize HTML authored by office staff before storing it in the DB.
 * Stripped of scripts, event handlers, iframes, etc.
 * Idempotent - safe to call on already-sanitized input.
 */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}
