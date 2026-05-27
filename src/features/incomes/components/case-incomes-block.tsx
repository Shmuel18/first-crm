import { Wallet } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBlock } from '@/features/cases/components/case-block';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { listIncomesForCase, listIncomeTypeOptions } from '../services/incomes.service';
import { BorrowerIncomesGroup } from './borrower-incomes-group';

type Props = { caseId: string };

/**
 * Server block that lists incomes per borrower on a case. Hidden entirely
 * when the caller lacks `view_case_incomes`, so it never renders an empty
 * shell that could leak the borrower list.
 */
export async function CaseIncomesBlock({ caseId }: Props) {
  const t = await getTranslations('incomes');
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
    console.error('[CaseIncomesBlock] data fetch failed', err);
  }

  const totalAcrossBorrowers = groups.reduce((sum, g) => sum + g.monthlyTotal, 0);
  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

  return (
    <CaseBlock
      title={t('blockTitle')}
      icon={<Wallet />}
      fullWidth
      rightSlot={
        groups.length > 0 && (
          <span className="text-xs text-neutral-600">
            {t('grandTotal')}:{' '}
            <span className="font-semibold text-neutral-900">{fmt.format(totalAcrossBorrowers)}</span>
          </span>
        )
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-4">{t('noBorrowers')}</p>
      ) : (
        // Side-by-side layout when there are exactly 2 borrowers (the
        // common case for couples) — each per-borrower income card gets
        // half the row instead of stretching full width. 1 or 3+ borrowers
        // fall back to a stacked layout where each card stays readable.
        <div
          className={
            groups.length === 2
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
              : 'space-y-5'
          }
        >
          {groups.map((g) => (
            <BorrowerIncomesGroup
              key={g.borrowerId}
              caseId={caseId}
              borrowerId={g.borrowerId}
              borrowerName={g.borrowerName}
              incomes={g.incomes}
              monthlyTotal={g.monthlyTotal}
              incomeTypes={incomeTypes}
              locale={locale}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </CaseBlock>
  );
}
