import sanitizeHtml from 'sanitize-html';

import { RICH_TEXT_ALLOWED_TAGS } from '@/lib/constants/sanitize';

/**
 * Sanitize HTML authored by office staff before storing it in the DB.
 * Stripped of scripts, event handlers, iframes, etc.
 * Idempotent - safe to call on already-sanitized input.
 *
 * Anchors are allowed but constrained: href must pass protocol filtering and
 * every surviving link gets target="_blank" plus rel="noopener noreferrer".
 */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html) return '';

  return sanitizeHtml(html, {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => (frame.tag === 'a' && !frame.attribs.href ? 'excludeTag' : false),
    transformTags: {
      a: (_tagName, attribs) => {
        const safeAttrs: Record<string, string> = {};
        if (attribs.href) {
          safeAttrs.href = attribs.href;
          safeAttrs.target = '_blank';
          safeAttrs.rel = 'noopener noreferrer';
        }
        return { tagName: 'a', attribs: safeAttrs };
      },
    },
  });
}
