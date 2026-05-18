import DOMPurify from 'isomorphic-dompurify';

/**
 * Whitelist matches what the RichTextEditor (Tiptap StarterKit + Underline)
 * can produce - nothing else gets through.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
] as const;

/**
 * Sanitize HTML authored by office staff before storing it in the DB.
 * Stripped of scripts, event handlers, iframes, etc.
 * Idempotent - safe to call on already-sanitized input.
 */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}
