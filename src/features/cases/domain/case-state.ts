/**
 * Pure functions deriving display state from a case row.
 * Kept in domain layer - no UI deps, no I/O.
 */

import type { CaseWithRelations } from '../types';

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

export function countStuck(cases: ReadonlyArray<CaseWithRelations>): number {
  return cases.filter(isStuckCase).length;
}

export function countNewThisWeek(cases: ReadonlyArray<CaseWithRelations>): number {
  return cases.filter((c) => {
    const days = (Date.now() - new Date(c.created_at).getTime()) / 86_400_000;
    return days <= 7;
  }).length;
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
