import { CreditCard } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBlock } from '@/features/cases/components/case-block';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { listObligationsForCase } from '../services/obligations.service';
import { BorrowerObligationsGroup } from './borrower-obligations-group';

type Props = { caseId: string };

/**
 * Server block listing obligations per borrower. Hidden when the caller
 * lacks `view_case_obligations` so the borrower list isn't leaked through
 * an empty shell.
 */
export async function CaseObligationsBlock({ caseId }: Props) {
  const t = await getTranslations('obligations');
  const [canView, canEdit] = await Promise.all([
    userHasPermission('view_case_obligations'),
    userCanEditCase(caseId),
  ]);
  if (!canView) return null;

  const locale = parseLocale(await getLocale());

  // Defensive: see CaseIncomesBlock — degrade to empty rather than crashing
  // the whole case page if the fetch throws.
  let groups: Awaited<ReturnType<typeof listObligationsForCase>> = [];
  try {
    groups = await listObligationsForCase(asCaseId(caseId));
  } catch (err) {
    console.error('[CaseObligationsBlock] data fetch failed', err);
  }

  const totalMonthly = groups.reduce((sum, g) => sum + g.monthlyPaymentTotal, 0);
  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

  return (
    <CaseBlock
      title={t('blockTitle')}
      icon={<CreditCard />}
      fullWidth
      rightSlot={
        groups.length > 0 && (
          <span className="text-xs text-neutral-600">
            {t('grandTotal')}:{' '}
            <span className="font-semibold text-neutral-900">{fmt.format(totalMonthly)}</span>
          </span>
        )
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-4">{t('noBorrowers')}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <BorrowerObligationsGroup
              key={g.borrowerId}
              caseId={caseId}
              borrowerId={g.borrowerId}
              borrowerName={g.borrowerName}
              obligations={g.obligations}
              monthlyPaymentTotal={g.monthlyPaymentTotal}
              remainingDebtTotal={g.remainingDebtTotal}
              locale={locale}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </CaseBlock>
  );
}
