/**
 * Display a person's name in the office convention: family name first, then
 * given name (e.g. "כהן דוד"). Single source of truth for name ordering across
 * the app — dashboard, tasks, cards, exports, PDFs.
 *
 * Arguments are taken in natural (first, last) order to mirror the DB row /
 * form shape; the RETURNED string is last-first. Nullish/empty parts are
 * dropped, so a record with only one name still renders cleanly.
 *
 * NOTE: salutations (WhatsApp / email "שלום …" greetings) intentionally do NOT
 * use this — a greeting reads more naturally with the given name.
 */
export function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [lastName, firstName].filter(Boolean).join(' ').trim();
}
