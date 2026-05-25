/**
 * HTML tag whitelist for rich-text content (request_details).
 * Matches what Tiptap StarterKit v3 (with Underline + Link) can produce.
 * Anything else is stripped by sanitizeRichTextHtml.
 *
 * The 'a' entry is paired with href filtering in sanitize-html.ts: DOMPurify's
 * default ALLOWED_URI_REGEXP rejects javascript:/data:/vbscript:, and a hook
 * forces target="_blank" + rel="noopener noreferrer" on every anchor.
 */
export const RICH_TEXT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'code',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
] as const;
