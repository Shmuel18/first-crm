import { getLocale } from 'next-intl/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { listIncomesForCase, listIncomeTypeOptions } from '../services/incomes.service';
import { CaseIncomesClient } from './case-incomes-client';

type Props = { caseId: string };

/**
 * Server block that lists incomes per borrower on a case. Hidden entirely when
 * the caller lacks `view_case_incomes`, so it never renders an empty shell that
 * could leak the borrower list.
 *
 * Only fetches + gates here; the block shell, the reactive grand total, each
 * borrower's optimistic list and the eager "primary employment" init all live
 * in CaseIncomesClient so inline edits don't revalidate the whole case page.
 */
export async function CaseIncomesBlock({ caseId }: Props) {
  const [canView, canEdit] = await Promise.all([
    userHasPermission('view_case_incomes'),
    userCanEditCase(caseId),
  ]);
  if (!canView) return null;

  const locale = parseLocale(await getLocale());

  // Defensive: if either fetch throws (RLS rejection, missing column, network),
  // log it and degrade to an empty block instead of crashing the whole case
  // page. The page is more useful WITHOUT the incomes block than not loading.
  let groups: Awaited<ReturnType<typeof listIncomesForCase>> = [];
  let incomeTypes: Awaited<ReturnType<typeof listIncomeTypeOptions>> = [];
  try {
    [groups, incomeTypes] = await Promise.all([
      listIncomesForCase(asCaseId(caseId)),
      listIncomeTypeOptions(),
    ]);
  } catch (err) {
    // Same flatten-to-string trick as CaseObligationsBlock — see comment there.
    const summary =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : err && typeof err === 'object'
          ? JSON.stringify(err, Object.getOwnPropertyNames(err))
          : String(err);
    console.error(`[CaseIncomesBlock] data fetch failed — ${summary}`);
  }

  return (
    <CaseIncomesClient
      caseId={caseId}
      initialGroups={groups}
      incomeTypes={incomeTypes}
      locale={locale}
      canEdit={canEdit}
    />
  );
}
