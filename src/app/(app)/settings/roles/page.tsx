import { redirect } from 'next/navigation';

/**
 * Merged into /settings/people (the "roles" sub-tab). This redirect
 * preserves links from the previous /settings/roles page.
 */
export default function RolesSettingsRedirect(): never {
  redirect('/settings/people?tab=roles');
}
