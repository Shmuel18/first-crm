/**
 * Shared FormData helpers used by server actions to turn a FormData object
 * into a plain JS object for Zod parsing, and into a values map for
 * round-tripping back to the form on validation errors.
 */

export function formDataToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  fd.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}

export function formDataToValues(fd: FormData): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  fd.forEach((v, k) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}
