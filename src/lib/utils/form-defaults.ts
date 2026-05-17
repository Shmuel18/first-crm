/**
 * Resolves the default value for a form field, preferring (in order):
 *   1. Submitted values from a previous failed submission (preserve user input)
 *   2. The existing record's value (in edit mode)
 *   3. Empty string
 */
export function fieldDefault(
  fieldName: string,
  submitted: Partial<Record<string, string>> | undefined,
  initial: Record<string, unknown> | null | undefined,
): string {
  if (submitted && fieldName in submitted) {
    return submitted[fieldName] ?? '';
  }
  if (!initial) return '';
  const value = initial[fieldName];
  if (value === null || value === undefined) return '';
  return String(value);
}
