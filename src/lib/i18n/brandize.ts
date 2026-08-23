import { BRAND } from '@/lib/brand';

import type { AbstractIntlMessages } from 'next-intl';

/** Longest-first so partial names never clobber fuller ones. */
const KAUFMAN_NAMES: ReadonlyArray<[pattern: string, key: keyof typeof REPLACEMENTS]> = [
  ['Kaufman Finance Group', 'nameEn'],
  ['קופמן פייננס גרופ', 'nameHe'],
  ['קופמן פייננס', 'nameHe'],
  ['קופמן', 'shortNameHe'],
  ['Kaufman', 'shortNameEn'],
];

const REPLACEMENTS = {
  nameEn: BRAND.nameEn,
  nameHe: BRAND.nameHe,
  shortNameHe: BRAND.shortNameHe,
  shortNameEn: BRAND.shortNameEn,
} as const;

/** Same catalog module in -> same branded object out. The dynamic import in
 * i18n/request.ts caches the module per locale, so keying on it gives one
 * brandize pass per locale per process instead of one per request. */
const cache = new WeakMap<AbstractIntlMessages, AbstractIntlMessages>();

/**
 * Substitutes the office name into the message catalog at load time.
 * The catalogs are authored with the default brand's (Kaufman's) names;
 * white-label deployments swap them here — one mechanism instead of
 * threading an {appName} param through every t() call site.
 */
export function brandizeMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  if (BRAND.key === 'kaufman') return messages;
  const cached = cache.get(messages);
  if (cached) return cached;
  let json = JSON.stringify(messages);
  for (const [pattern, key] of KAUFMAN_NAMES) {
    json = json.replaceAll(pattern, REPLACEMENTS[key]);
  }
  // Round-trip through the same shape we serialized — safe to assert.
  const branded = JSON.parse(json) as AbstractIntlMessages;
  cache.set(messages, branded);
  return branded;
}
