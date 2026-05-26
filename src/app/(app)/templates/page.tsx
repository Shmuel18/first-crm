import { redirect } from 'next/navigation';

/**
 * Page moved to /settings/templates to keep admin-only management together
 * under Settings. This redirect preserves any existing bookmarks /
 * deep-links from before the move.
 */
export default function TemplatesPage(): never {
  redirect('/settings/templates');
}
