/**
 * Pure functions deriving display state from a case row.
 * Kept in domain layer - no UI deps, no I/O.
 */

export function isStuckCase(c: { status: { key: string } | null }): boolean {
  return c.status?.key === 'stuck';
}

export function isFrozenCase(c: { status: { key: string } | null }): boolean {
  return c.status?.key === 'on_hold' || c.status?.key === 'closed';
}

export function isRecentlyUpdated(c: { updated_at: string }, withinHours = 24): boolean {
  const diff = Date.now() - new Date(c.updated_at).getTime();
  return diff / 3_600_000 < withinHours;
}

export function getInitials(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const f = first?.[0] ?? '';
  const l = last?.[0] ?? '';
  const combined = (f + l).trim();
  return combined || '?';
}
