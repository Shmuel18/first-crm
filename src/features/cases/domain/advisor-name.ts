import { formatPersonName } from '@/lib/utils/person-name';

type AdvisorLike = { id: string; first_name: string | null; last_name: string | null };

/**
 * Resolve an advisor's display name from the case's assigned_advisor_id against
 * the loaded options list. Needed because the cases→profiles embed is RLS-gated
 * to NULL for non-admins (secretary / senior advisor), while the options list —
 * sourced from the identity-only list_active_advisors() RPC (migration 145) —
 * still carries the name. Returns null when unknown so callers can show the
 * "not assigned" fallback.
 */
export function resolveAdvisorName(
  advisorId: string | null,
  options: ReadonlyArray<AdvisorLike>,
): string | null {
  if (!advisorId) return null;
  const match = options.find((o) => o.id === advisorId);
  return match ? formatPersonName(match.first_name, match.last_name) || null : null;
}
