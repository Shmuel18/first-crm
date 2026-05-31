import { redirect } from 'next/navigation';

/**
 * Page moved under Settings to keep admin-only management together. Point
 * straight at the final target (/settings/people?tab=members) so this
 * legacy bookmark / deep-link doesn't pay a second redirect hop through
 * /settings/team.
 */
export default function TeamPage(): never {
  redirect('/settings/people?tab=members');
}
