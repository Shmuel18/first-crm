/**
 * Mentions are embedded in a comment body as `@[Display Name](uuid)` tokens.
 * This is the contract shared by the composer (insert), the DB trigger
 * (notify), and the bubble (render as pills). Pure helpers — no React/DOM.
 */

// Loose uuid shape is fine for parsing display; the DB trigger uses a strict
// uuid pattern where a bad cast would matter.
const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; name: string; uuid: string };

/** Split a stored body into ordered text / mention segments for rendering. */
export function parseMentionBody(body: string): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: 'text', value: body.slice(last, idx) });
    out.push({ type: 'mention', name: m[1] ?? '', uuid: m[2] ?? '' });
    last = idx + m[0].length;
  }
  if (last < body.length) out.push({ type: 'text', value: body.slice(last) });
  return out;
}

/**
 * If the caret sits inside an `@query` token (started by whitespace or BOF and
 * containing no space yet), return the query and the `@` index. Otherwise null.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]*)$/.exec(before);
  if (!m) return null;
  const query = m[2] ?? '';
  return { start: caret - query.length - 1, query };
}

/** Replace the `@query` span [start, caret) with a full mention token. */
export function insertMention(
  text: string,
  start: number,
  caret: number,
  name: string,
  uuid: string,
): { value: string; caret: number } {
  const token = `@[${name}](${uuid}) `;
  return { value: text.slice(0, start) + token + text.slice(caret), caret: start + token.length };
}
