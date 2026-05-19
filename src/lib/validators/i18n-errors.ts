import { getTranslations } from 'next-intl/server';

import type { z } from 'zod';

/**
 * Resolve Zod error messages from i18n keys to translated strings.
 *
 * Convention: schemas use dotted keys like "common.errors.invalidEmail" as
 * the error string. This helper checks each issue's message - if it looks
 * like a key (dotted, no spaces), it resolves via next-intl; otherwise it
 * passes through (covers legacy literal messages in any not-yet-migrated
 * schema).
 *
 * One message per path - the first issue for a path wins (matches Zod's
 * own first-error convention for fieldErrors).
 */
export async function resolveSchemaErrors(
  zodError: z.ZodError,
): Promise<Record<string, string>> {
  const t = await getTranslations();
  const fieldErrors: Record<string, string> = {};

  for (const issue of zodError.issues) {
    const path = issue.path.join('.');
    if (fieldErrors[path]) continue;

    const raw = issue.message;
    if (raw && raw.includes('.') && !/\s/.test(raw)) {
      try {
        fieldErrors[path] = t(raw);
      } catch {
        fieldErrors[path] = raw;
      }
    } else {
      fieldErrors[path] = raw;
    }
  }

  return fieldErrors;
}
