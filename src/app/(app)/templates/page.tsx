import { redirect } from 'next/navigation';

/**
 * Legacy /templates deep-link. Templates management is hidden (deferred to
 * Phase 2 — see ../settings/templates/page.tsx for the full rationale), so old
 * bookmarks land on the profile page instead of a now-redirecting tab.
 */
export default function TemplatesPage(): never {
  redirect('/settings/profile');
}
