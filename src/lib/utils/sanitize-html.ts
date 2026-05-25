import DOMPurify from 'isomorphic-dompurify';

import { RICH_TEXT_ALLOWED_TAGS } from '@/lib/constants/sanitize';

// Force every <a> (after attribute sanitization) to open in a new tab with
// safe rel attrs. DOMPurify's default ALLOWED_URI_REGEXP already blocks
// javascript:/data:/vbscript: schemes in href, so this hook is purely about
// the navigation context — preventing the linked page from reaching back
// into window.opener and stopping cross-origin referrer leaks.
//
// The hook is registered once at module load. isomorphic-dompurify exposes
// a single shared DOMPurify instance, so registering more than once would
// stack duplicate hooks — guard with a module-level flag.
let hookRegistered = false;
function ensureAnchorHookRegistered(): void {
  if (hookRegistered) return;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ('tagName' in node && (node as Element).tagName === 'A') {
      const el = node as Element;
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  hookRegistered = true;
}

/**
 * Sanitize HTML authored by office staff before storing it in the DB.
 * Stripped of scripts, event handlers, iframes, etc.
 * Idempotent — safe to call on already-sanitized input.
 *
 * Anchors are allowed but constrained: href must pass DOMPurify's protocol
 * filter (http/https/mailto by default) and gets target="_blank" plus
 * rel="noopener noreferrer" forced on every render.
 */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html) return '';
  ensureAnchorHookRegistered();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    // target / rel aren't in ALLOWED_ATTR — the hook re-adds them after
    // sanitization, so DOMPurify can still strip any user-supplied values.
    ALLOWED_ATTR: ['href'],
    KEEP_CONTENT: true,
  });
}
