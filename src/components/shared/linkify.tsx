import { Fragment } from 'react';

import type { ReactNode } from 'react';

/**
 * URLs and emails in free text. Matched forms:
 *   - scheme / www:   https://x.y/z  ·  www.x.y/z
 *   - bare host+path: titan.com/ftproject/…  (a path is required so plain
 *                     "file.pdf" / "v2.0" don't get linkified)
 *   - email:          a@b.co
 * Phone numbers are deliberately NOT linkified — too many false positives with
 * Israeli IDs, case numbers, and ₪ amounts in this domain.
 */
const TOKEN_RE =
  /((?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<]+)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;
/** Trailing punctuation that's part of the sentence, not the URL. */
const TRAILING = /[.,;:!?)\]}'"׳״]+$/;
const LINK_CLASS =
  'text-brand-gold-text underline underline-offset-2 hover:text-brand-gold-dark break-all';

/**
 * Renders plain text with URLs / emails turned into clickable links — building
 * React elements (never dangerouslySetInnerHTML), so the text is auto-escaped
 * and a `javascript:` token simply isn't matched (stays inert text). Whitespace
 * and line breaks are preserved.
 */
export function Linkify({ text, className }: { text: string; className?: string }): ReactNode {
  if (!text) return null;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  // Fresh regex instance — the global flag is stateful.
  const re = new RegExp(TOKEN_RE);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const [raw] = match;
    const isEmail = match[2] !== undefined;
    // Pull any sentence punctuation off the end back into the plain text.
    const trail = isEmail ? '' : (TRAILING.exec(raw)?.[0] ?? '');
    const token = trail ? raw.slice(0, raw.length - trail.length) : raw;

    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const href = isEmail
      ? `mailto:${token}`
      : token.startsWith('http')
        ? token
        : `https://${token}`;
    parts.push(
      <a
        key={key++}
        href={href}
        {...(isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer nofollow' })}
        className={LINK_CLASS}
        onClick={(e) => e.stopPropagation()}
      >
        {token}
      </a>,
    );
    if (trail) parts.push(trail);
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <span className={className ?? 'whitespace-pre-wrap break-words'}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </span>
  );
}
