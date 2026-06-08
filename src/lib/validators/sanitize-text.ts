/**
 * Invisible bidirectional & zero-width control characters that get injected
 * into inputs typed or pasted in an RTL (Hebrew) context. They are invisible
 * to the user but break strict validators: e.g. a U+200F (RLM) mark lands
 * beside a Latin-script email and `z.email()` silently rejects the address,
 * leaving the user staring at what looks like a perfectly valid value.
 *
 * Covers: zero-width chars (ZWSP/ZWNJ/ZWJ U+200B-200D, BOM U+FEFF),
 * directional marks (LRM/RLM U+200E-200F), bidi embeddings/overrides
 * (U+202A-202E), and the word-joiner / isolates block (U+2060-206F).
 *
 * Built via `new RegExp` from a pure-ASCII pattern string so the source file
 * never embeds the invisible characters themselves (which editors and tooling
 * can silently strip or mangle).
 */
const INVISIBLE_FORMAT_CHARS = new RegExp(
  '[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]',
  'g',
);

/** Removes invisible bidi / zero-width control characters from a string. */
export function stripInvisible(value: string): string {
  return value.replace(INVISIBLE_FORMAT_CHARS, '');
}
