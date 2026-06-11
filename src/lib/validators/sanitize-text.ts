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

// ASCII C0 control chars + DEL. For single-line fields ALL of them (incl.
// \r\n\t) collapse to a space; for multi-line fields tab/newline/CR survive.
const CONTROL_CHARS_ALL = new RegExp('[\\u0000-\\u001F\\u007F]+', 'g');
const CONTROL_CHARS_KEEP_BREAKS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]',
  'g',
);

/** Removes invisible bidi / zero-width control characters from a string. */
export function stripInvisible(value: string): string {
  return value.replace(INVISIBLE_FORMAT_CHARS, '');
}

/**
 * Normalizer for SINGLE-LINE form values (names, subjects, identifiers):
 * strips invisible bidi/zero-width chars, collapses any ASCII control char
 * run (incl. CR/LF — a newline in a "name" later lands in email subjects)
 * to a single space, and trims. Multi-line content must NOT go through this.
 */
export function sanitizeSingleLine(value: string): string {
  return stripInvisible(value).replace(CONTROL_CHARS_ALL, ' ').trim();
}

/**
 * Normalizer for MULTI-LINE form values (notes, rich-text source): strips
 * invisible bidi/zero-width chars and control chars EXCEPT tab/newline/CR,
 * then trims outer whitespace. Line structure is preserved.
 */
export function sanitizeMultiLine(value: string): string {
  return stripInvisible(value).replace(CONTROL_CHARS_KEEP_BREAKS, '').trim();
}
