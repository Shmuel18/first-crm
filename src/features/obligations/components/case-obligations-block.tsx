import { getLocale } from 'next-intl/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { listObligationsFlatForCase } from '../services/obligations.service';
import { CaseObligationsClient } from './case-obligations-client';

type Props = { caseId: string };

/**
 * Case-level obligations block. Obligations are accounted for at the case
 * level (a couple's combined debt picture), so the UI lists them flat
 * instead of splitting per borrower. New obligations are billed to the
 * primary borrower in the DB; the visible list is unified.
 *
 * This Server Component only fetches + gates on permission; the block shell,
 * the reactive grand-total header and the optimistic list all live in
 * CaseObligationsClient so inline edits don't revalidate the whole case page.
 *
 * Hidden when the caller lacks `view_case_obligations` so an empty shell
 * doesn't leak the case structure to non-viewers.
 */
export async function CaseObligationsBlock({ caseId }: Props) {
  const [canView, canEdit] = await Promise.all([
    userHasPermission('view_case_obligations'),
    userCanEditCase(caseId),
  ]);
  if (!canView) return null;

  const locale = parseLocale(await getLocale());

  let view: Awaited<ReturnType<typeof listObligationsFlatForCase>> = {
    obligations: [],
    primaryBorrowerId: null,
    monthlyPaymentTotal: 0,
    remainingDebtTotal: 0,
  };
  try {
    view = await listObligationsFlatForCase(asCaseId(caseId));
  } catch (err) {
    // Flatten to a single-line STRING so console.error in dev overlay /
    // Chrome devtools shows the fields directly instead of collapsing to
    // "Object". JSON.stringify catches own-properties — covers Supabase
    // PostgrestError shape (message / code / details / hint) AND any
    // future shape we haven't enumerated.
    const summary =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : err && typeof err === 'object'
          ? JSON.stringify(err, Object.getOwnPropertyNames(err))
          : String(err);
    console.error(`[CaseObligationsBlock] data fetch failed — ${summary}`);
  }

  return (
    <CaseObligationsClient
      caseId={caseId}
      primaryBorrowerId={view.primaryBorrowerId}
      initialObligations={view.obligations}
      locale={locale}
      canEdit={canEdit}
    />
  );
}
