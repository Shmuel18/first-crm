import { redirect } from 'next/navigation';

/**
 * Page moved to /settings/audit-log to keep admin-only tools together
 * under Settings. This redirect preserves any existing bookmarks /
 * deep-links from before the move.
 */
export default function AuditLogPage(): never {
  redirect('/settings/audit-log');
}
