'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CaseBlock } from '@/features/cases/components/case-block';
import { formatCurrency } from '@/lib/utils/format-currency';

import { createEmptyIncomeAction } from '../actions/create-empty-income';
import { deleteIncomeAction } from '../actions/delete-income';
import {
  updateIncomeFieldAction,
  type EditableIncomeField,
} from '../actions/update-income-field';
import { sumMonthlyIncomes } from '../domain/totals';
import { BorrowerIncomesGroup } from './borrower-incomes-group';
import {
  buildIncomesSignature,
  emptyIncomeRow,
  mapGroupIncomes,
  mapIncome,
  toIncomeGroupState,
  type IncomeGroupState,
} from './income-optimistic';
import type {
  BorrowerIncomesGroup as BorrowerIncomesGroupData,
  IncomeSaveResult,
  IncomeTypeOption,
  IncomeWithType,
} from '../types';

type Props = {
  caseId: string;
  initialGroups: ReadonlyArray<BorrowerIncomesGroupData>;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * Owns the per-borrower income lists as client state (FE-1) so add / delete /
 * inline edit apply optimistically and the grand total + each borrower subtotal
 * recompute from the same state. The actions no longer call revalidatePath,
 * which used to re-render + re-fetch the whole heavy case page and discard
 * scroll. Mirrors the case-banks / obligations pattern; resyncs to server truth
 * on prop change; auto-creates each borrower's structural primary-income slot.
 */
export function CaseIncomesClient({ caseId, initialGroups, incomeTypes, locale, canEdit }: Props) {
  const t = useTranslations('incomes');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  const [groups, setGroups] = useState<IncomeGroupState[]>(() => toIncomeGroupState(initialGroups));
  const sig = buildIncomesSignature(initialGroups);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setGroups(toIncomeGroupState(initialGroups));
  }

  // Snapshot so handlers read current rows without depending on `groups` (keeps
  // callbacks stable so the eager-init effect can't loop). Updated in an effect.
  const groupsRef = useRef(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  const tempCounter = useRef(0);

  const grandTotal = useMemo(() => sumMonthlyIncomes(groups.flatMap((g) => g.incomes)), [groups]);

  const addIncome = useCallback(
    (borrowerId: string) => {
      const tempId = `optimistic-${borrowerId}-${tempCounter.current++}`;
      setGroups((prev) =>
        mapGroupIncomes(prev, borrowerId, (inc) => [...inc, emptyIncomeRow(tempId, borrowerId)]),
      );
      startAdd(async () => {
        const result = await createEmptyIncomeAction(caseId, borrowerId);
        if (!result.ok) {
          setGroups((prev) =>
            mapGroupIncomes(prev, borrowerId, (inc) => inc.filter((i) => i.id !== tempId)),
          );
          toast.error(result.message || tc('saveFailed'));
          return;
        }
        setGroups((prev) => mapIncome(prev, borrowerId, tempId, (i) => ({ ...i, id: result.incomeId })));
      });
    },
    [caseId, tc, startAdd],
  );

  const deleteIncome = useCallback(
    (borrowerId: string, incomeId: string) => {
      const group = groupsRef.current.find((g) => g.borrowerId === borrowerId);
      const index = group?.incomes.findIndex((i) => i.id === incomeId) ?? -1;
      const removed = index >= 0 ? group?.incomes[index] : undefined;
      if (!removed) return;
      setGroups((prev) => mapGroupIncomes(prev, borrowerId, (inc) => inc.filter((i) => i.id !== incomeId)));
      void deleteIncomeAction(incomeId, borrowerId, caseId).then((result) => {
        if (result.ok) {
          toast.success(t('deleteSuccess'));
          return;
        }
        setGroups((prev) =>
          mapGroupIncomes(prev, borrowerId, (inc) => {
            const next = [...inc];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
        );
        toast.error(t('deleteError'));
      });
    },
    [caseId, t],
  );

  const saveField = useCallback(
    async (
      borrowerId: string,
      incomeId: string,
      field: EditableIncomeField,
      value: unknown,
    ): Promise<IncomeSaveResult> => {
      const target = groupsRef.current
        .find((g) => g.borrowerId === borrowerId)
        ?.incomes.find((i) => i.id === incomeId);
      if (!target) return { ok: false };
      const prevValue = target[field];
      const prevType = target.income_type;

      const typeFor = (id: unknown): IncomeWithType['income_type'] => {
        const opt = incomeTypes.find((it) => it.id === id);
        return opt ? { id: opt.id, key: opt.key, name_he: opt.name_he, name_en: opt.name_en } : null;
      };
      // `as never` for the computed-key write: EditableIncomeField spans
      // string/number/null columns, so a dynamic [field] write can't be proven
      // type-safe; the action validates field + value. A type change also swaps
      // the joined income_type so the card header updates without a round-trip.
      setGroups((prev) =>
        mapIncome(prev, borrowerId, incomeId, (i) => {
          const next = { ...i, [field]: value as never };
          if (field === 'income_type_id') next.income_type = typeFor(value);
          return next;
        }),
      );

      const result = await updateIncomeFieldAction(incomeId, caseId, field, value);
      if (!result.ok) {
        setGroups((prev) =>
          mapIncome(prev, borrowerId, incomeId, (i) => ({
            ...i,
            [field]: prevValue as never,
            income_type: field === 'income_type_id' ? prevType : i.income_type,
          })),
        );
        return { ok: false, message: result.message };
      }
      return { ok: true };
    },
    [caseId, incomeTypes],
  );

  // Eager init: every borrower shows at least one income card (the structural
  // "primary employment" slot). Fire once per borrower that loads with zero
  // rows. eagerRef guards re-fire and does NOT retry on failure, so a
  // persistently-failing insert can't loop — the user adds manually.
  const eagerRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!canEdit) return;
    for (const g of groups) {
      if (g.incomes.length === 0 && !eagerRef.current.has(g.borrowerId)) {
        eagerRef.current.add(g.borrowerId);
        addIncome(g.borrowerId);
      }
    }
  }, [groups, canEdit, addIncome]);

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
