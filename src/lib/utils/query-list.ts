/**
 * A multi-select URL param → the list of values it carries.
 *
 * nuqs' `parseAsArrayOf` writes ONE comma-joined param (`?stage=a,b`) and
 * escapes a literal comma inside a value as `%2C`; this is the server-side
 * mirror of that encoding, so a page/route that reads raw searchParams sees
 * exactly what the picker wrote. A repeated param (`?stage=a&stage=b`) and a
 * plain single value both parse too — old bookmarks, the "back to dashboard"
 * memory and AI-built urls keep working unchanged.
 *
 * Blanks are dropped, order is preserved, duplicates collapse.
 */
export function parseQueryList(value: string | string[] | undefined): string[] {
  const entries = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const items = entries
    .flatMap((entry) => entry.split(','))
    .map((item) => item.replaceAll('%2C', ',').trim())
    .filter((item) => item !== '');
  return [...new Set(items)];
}
