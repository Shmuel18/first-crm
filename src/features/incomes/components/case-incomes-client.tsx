'use client';

import { useMemo } from 'react';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CaseBlock } from '@/features/cases/components/case-block';
import { formatCurrency } from '@/lib/utils/format-currency';

import { sumMonthlyIncomes } from '../domain/totals';
import { useEagerPrimaryIncome } from '../hooks/use-eager-primary-income';
import { useIncomeGroups } from '../hooks/use-income-groups';
import { BorrowerIncomesGroup } from './borrower-incomes-group';
import type {
  BorrowerIncomesGroup as BorrowerIncomesGroupData,
  IncomeTypeOption,
} from '../types';

type Props = {
  caseId: string;
  initialGroups: ReadonlyArray<BorrowerIncomesGroupData>;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * Renders the per-borrower income lists; state lives in useIncomeGroups
 * (optimistic add / delete / inline edit — the actions skip revalidatePath so
 * the heavy case page never re-renders, and the hook's debounced background
 * router.refresh keeps the router cache from restoring the pre-mutation
 * page). The grand total + each borrower subtotal recompute from the same
 * client state; useEagerPrimaryIncome auto-creates each borrower's structural
 * primary-income slot.
 */
export function CaseIncomesClient({ caseId, initialGroups, incomeTypes, locale, canEdit }: Props) {
  const t = useTranslations('incomes');

  const { groups, isAdding, addIncome, deleteIncome, saveField, rowKey } = useIncomeGroups(
    caseId,
    initialGroups,
    incomeTypes,
  );
  useEagerPrimaryIncome(groups, canEdit, addIncome);

  const grandTotal = useMemo(() => sumMonthlyIncomes(groups.flatMap((g) => g.incomes)), [groups]);

  return (
    <CaseBlock
      title={t('blockTitle')}
      icon={<Wallet />}
      fullWidth
      blockKey="incomes"
      rightSlot={
        groups.length > 0 && (
          <span className="text-xs text-neutral-600">
            {t('grandTotal')}:{' '}
            <span className="font-semibold text-neutral-900">
              {formatCurrency(grandTotal, locale)}
            </span>
          </span>
        )
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-4">{t('noBorrowers')}</p>
      ) : (
        // Side-by-side for the common 2-borrower (couple) case; stacked for 1 or 3+.
        <div className={groups.length === 2 ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-5'}>
          {groups.map((g) => (
            <BorrowerIncomesGroup
              key={g.borrowerId}
              borrowerName={g.borrowerName}
              incomes={g.incomes}
              monthlyTotal={sumMonthlyIncomes(g.incomes)}
              incomeTypes={incomeTypes}
              locale={locale}
              canEdit={canEdit}
              isAdding={isAdding}
              rowKey={rowKey}
              onAdd={() => addIncome(g.borrowerId)}
              onSaveField={(incomeId, field, value) => saveField(g.borrowerId, incomeId, field, value)}
              onDelete={(incomeId) => deleteIncome(g.borrowerId, incomeId)}
            />
          ))}
        </div>
      )}
    </CaseBlock>
  );
}
