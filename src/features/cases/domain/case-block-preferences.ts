/**
 * Per-user "which case-page blocks open by default" preference (pure domain).
 *
 * The case detail page is a stack of collapsible blocks (CaseBlock), all
 * closed by default. A user can opt to have specific blocks open on load via
 * Settings → Display. Stored per user as a JSONB map (block key → boolean);
 * a missing key means "closed" (the historical default), so existing users
 * keep the all-closed behavior until they choose otherwise.
 */

export const CASE_BLOCK_KEYS = [
  'borrowers',
  'requestDetails',
  'incomes',
  'obligations',
  'property',
  'admin',
] as const;

export type CaseBlockKey = (typeof CASE_BLOCK_KEYS)[number];

export type CaseBlockPreferences = Record<CaseBlockKey, boolean>;

/** All blocks closed — matches the long-standing default. */
export const DEFAULT_CASE_BLOCK_PREFERENCES: CaseBlockPreferences = {
  borrowers: false,
  requestDetails: false,
  incomes: false,
  obligations: false,
  property: false,
  admin: false,
};

/**
 * Coerce an arbitrary stored value (JSONB, possibly partial / from an older
 * shape) into a complete CaseBlockPreferences. Unknown keys are dropped and
 * missing keys default to closed, so the case page always gets every key.
 */
export function normalizeCaseBlockPreferences(raw: unknown): CaseBlockPreferences {
  const out: CaseBlockPreferences = { ...DEFAULT_CASE_BLOCK_PREFERENCES };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const map = raw as Record<string, unknown>;
    for (const key of CASE_BLOCK_KEYS) {
      if (map[key] === true) out[key] = true;
    }
  }
  return out;
}
