/**
 * HTML tag whitelist for rich-text content (request_details).
 * Matches what Tiptap StarterKit v3 (with Underline) can produce.
 * Anything else is stripped by sanitizeRichTextHtml.
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
] as const;
