import { redirect } from 'next/navigation';

/**
 * Page moved to /settings/team to keep admin-only management together
 * under Settings. This redirect preserves any existing bookmarks /
 * deep-links from before the move.
 */
export default function TeamPage(): never {
  redirect('/settings/team');
}
