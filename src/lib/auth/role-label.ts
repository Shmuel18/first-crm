/**
 * Role display labels.
 *
 * The two advisor roles share ONE public display name ("יועץ משכנתאות"), set on
 * `roles.name_he/name_en` (migration 113) — so the topbar, profile, and every
 * other general surface show the generic title automatically, without revealing
 * a seniority level.
 *
 * Only the admin-only management screens (/settings/people: team table, role
 * picker, invite dialog, roles-permissions editor) need to tell the two levels
 * apart — for that they call `roleManagementLabel`, which maps the role KEY to a
 * translated level label and falls back to the DB name for every other role.
 *
 * Mapping is by KEY (stable), never by name (display-only, may change):
 *   senior_advisor → 'extended'  ("יועץ משכנתאות מורחב")
 *   junior_advisor → 'base'      ("יועץ משכנתאות")
 */

export type AdvisorLevel = 'base' | 'extended';

export function advisorLevel(roleKey: string): AdvisorLevel | null {
  if (roleKey === 'senior_advisor') return 'extended';
  if (roleKey === 'junior_advisor') return 'base';
  return null;
}

type RoleNameFields = {
  key: string;
  name_he: string | null;
  name_en: string | null;
};

/**
 * Label for the admin-only management screens. Advisor roles resolve to their
 * translated level label; all other roles use their locale display name.
 */
export function roleManagementLabel(
  role: RoleNameFields,
  locale: 'he' | 'en',
  tLevel: (level: AdvisorLevel) => string,
): string {
  const level = advisorLevel(role.key);
  if (level) return tLevel(level);
  return (locale === 'he' ? role.name_he : role.name_en) ?? '';
}
