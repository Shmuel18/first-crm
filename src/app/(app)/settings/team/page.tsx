import { redirect } from 'next/navigation';

/**
 * Merged into /settings/people (the "members" sub-tab). This redirect
 * preserves links from the previous /settings/team page and the original
 * top-level /team route.
 */
export default function TeamSettingsRedirect(): never {
  redirect('/settings/people?tab=members');
}
