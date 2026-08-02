/**
 * Pure functions deriving display state from a case row.
 * Kept in domain layer - no UI deps, no I/O.
 */

/** Statuses that auto-archive their case (migrations 226/227). Selecting one
 *  of these in the ACTIVE view's stage filter can only yield an empty list —
 *  the dashboard prunes them from that picker. */
export const AUTO_ARCHIVED_STATUS_KEYS = ['closed', 'on_hold', 'stuck'] as const;

export function isStuckCase(c: { status: { key: string } | null }): boolean {
  return c.status?.key === 'stuck';
}

export function isFrozenCase(c: { status: { key: string } | null }): boolean {
  return c.status?.key === 'on_hold' || c.status?.key === 'closed';
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
