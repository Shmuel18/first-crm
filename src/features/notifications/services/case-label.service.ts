import type { createAdminClient } from '@/lib/supabase/admin';

import { buildCaseLabel, type CaseLabel } from '../domain/case-label';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolves "#<case_number> · <primary borrower>" for a set of cases, so a
 * notification (bell payload or email) can say WHICH client it is about.
 * Two batched reads regardless of how many cases are asked for; unknown ids
 * are simply absent from the map. Admin client — these run in system paths
 * (crons, webhook mirror) where there is no user session.
 */
export async function resolveCaseLabels(
  admin: AdminClient,
  caseIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, CaseLabel>> {
  const labels = new Map<string, CaseLabel>();
  const ids = Array.from(new Set(caseIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return labels;

  const { data: cases } = await admin
    .from('cases')
    .select('id, case_number, primary_borrower_id')
    .in('id', ids);
  if (!cases || cases.length === 0) return labels;

  const borrowerIds = cases
    .map((c) => c.primary_borrower_id)
    .filter((id): id is string => Boolean(id));
  const names = await resolveBorrowerNames(admin, borrowerIds);

  for (const c of cases) {
    const name = c.primary_borrower_id ? (names.get(c.primary_borrower_id) ?? null) : null;
    labels.set(c.id, buildCaseLabel(c.case_number, name));
  }
  return labels;
}

/** Single-case convenience wrapper. Null for an office (case-less) context. */
export async function resolveCaseLabel(
  admin: AdminClient,
  caseId: string | null,
): Promise<CaseLabel | null> {
  if (!caseId) return null;
  const labels = await resolveCaseLabels(admin, [caseId]);
  return labels.get(caseId) ?? null;
}

async function resolveBorrowerNames(
  admin: AdminClient,
  borrowerIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (borrowerIds.length === 0) return names;

  const { data: borrowers } = await admin
    .from('borrowers')
    .select('id, first_name, last_name')
    .in('id', Array.from(new Set(borrowerIds)));

  for (const b of borrowers ?? []) {
    const name = [b.first_name, b.last_name].filter(Boolean).join(' ').trim();
    if (name) names.set(b.id, name);
  }
  return names;
}
