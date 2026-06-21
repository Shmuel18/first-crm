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

/**
 * Replace the `@query` span [start, caret) with a CLEAN `@name ` (no uuid shown).
 * The uuid is tracked separately by the composer and folded back in on submit via
 * buildMentionBody — so the user never sees the raw `@[name](uuid)` token.
 */
export function insertMentionPlain(
  text: string,
  start: number,
  caret: number,
  name: string,
): { value: string; caret: number } {
  const token = `@${name} `;
  return { value: text.slice(0, start) + token + text.slice(caret), caret: start + token.length };
}

/** A mention the composer recorded when the user picked it from the list. */
export type PickedMention = { name: string; uuid: string };

const isNameChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}_]/u.test(c);

/**
 * Turn the clean composer text (with visible `@name` mentions) into the stored
 * body with `@[name](uuid)` tokens, using the mentions the user picked. Each
 * picked mention claims the first not-yet-claimed `@name` occurrence whose name
 * ends on a boundary (so `@דן` never matches inside `@דני`). A picked mention
 * whose text was edited away is silently dropped — it just won't notify.
 */
export function buildMentionBody(text: string, picked: ReadonlyArray<PickedMention>): string {
  let result = '';
  let cursor = 0;
  for (const { name, uuid } of picked) {
    const needle = `@${name}`;
    let i = text.indexOf(needle, cursor);
    while (i !== -1 && isNameChar(text[i + needle.length])) {
      i = text.indexOf(needle, i + 1);
    }
    if (i === -1) continue;
    result += text.slice(cursor, i) + `@[${name}](${uuid})`;
    cursor = i + needle.length;
  }
  return result + text.slice(cursor);
}
