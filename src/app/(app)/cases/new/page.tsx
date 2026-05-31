import { redirect } from 'next/navigation';

import { getLocale } from 'next-intl/server';

import { NewCasePageClient } from '@/features/cases/components/new-case-page-client';
import { userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';

/**
 * /cases/new — draft-mode case creation page. See NewCasePageClient for
 * the full UX rationale: the page renders the detail-page shell with
 * borrowers + request_details editable, everything else locked until the
 * single "save" action commits the case + borrowers atomically via the
 * create_case_draft RPC (migration 074).
 *
 * Locale is the only thing the server hands down — the page itself fetches
 * no case-shaped data (there is no case yet). The lookup options that the
 * old form needed (case_types, statuses, advisors) all live behind locked
 * blocks now; the user will see them as inline editors after redirect to
 * /cases/[id].
 */
export default async function NewCasePage() {
  // Affordance↔guard parity with the topbar "New case" link and the
  // create_case check in save-case-draft.ts.
  if (!(await userHasPermission('create_case'))) redirect('/cases');

  const locale = parseLocale(await getLocale());
  return (
    <div className="max-w-5xl">
      <NewCasePageClient locale={locale} />
    </div>
  );
}
