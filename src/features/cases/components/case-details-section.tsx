'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CurrencySign } from '@/components/ui/currency-sign';
import { formatPersonName } from '@/lib/utils/person-name';

import { FieldGroup } from '@/features/borrowers/components/borrower-compact-fields';
import { EditableField } from '@/features/borrowers/components/editable-field';

import { updateCaseFeeAmountAction } from '../actions/update-case-fee-amount';
import { updateCaseFeePaidAction } from '../actions/update-case-fee-paid';
import { updateCaseFieldAction } from '../actions/update-case-field';
import {
  isEditableCaseField,
  type EditableCaseField,
} from '../domain/editable-case-fields';
import {
  CASE_BLOCKER_VALUES,
  INSURANCE_STATUS_VALUES,
} from '../schemas/case.schema';
import type {
  AdvisorOption,
  StatusOption,
} from '../services/case-lookups.service';
import type { CaseRow } from '../types';

import { AssociatedAdvisorsField } from './associated-advisors-field';
import { EditableStatusCell } from './editable-status-cell';

/**
 * "פרטי התיק" sub-section of the admin block. 8 inline-editable fields in
 * a 4-column FieldGroup row (matches the property block density):
 *   status · blocker · primary bank · advisor ·
 *   insurance · short note · referrer · agreed fee (manager only)
 *
 * Most fields route through the generic updateCaseFieldAction (same path
 * as the property block). The primary-bank field is special — it goes
 * through setPrimaryBankAction → set_primary_bank RPC (migration 021),
 * which idempotently reconciles case_banks (promote/insert/demote).
 */

type LocalCase = Pick<
  CaseRow,
  | 'status_id'
  | 'assigned_advisor_id'
  | 'case_blocker'
  | 'insurance_status'
  | 'insurance_agent_name'
  | 'appraiser_name'
  | 'target_date'
  | 'referrer_name'
  | 'short_note'
>;

type Props = {
  caseId: string;
  initial: LocalCase;
  /** Status lookup with name + color. EditableStatusCell renders the badge. */
  statusName: string | null;
  statusColor: string | null;
  statuses: ReadonlyArray<StatusOption>;
  advisors: ReadonlyArray<AdvisorOption>;
  /** Associated advisor ids (migration 146) + whether the user may edit them. */
  associatedAdvisorIds: ReadonlyArray<string>;
  canManageAdvisors: boolean;
  /** Manager-only: agreed fee shows + is editable only when this is true. */
  canSeeFinancials: boolean;
  initialFeeAmount: number | null;
  initialFeePaid: boolean;
  initialFeePaidAt: string | null;
};

export function CaseDetailsSection({
  caseId,
  initial,
  statusName,
  statusColor,
  statuses,
  advisors,
  associatedAdvisorIds,
  canManageAdvisors,
  canSeeFinancials,
  initialFeeAmount,
  initialFeePaid,
  initialFeePaidAt,
}: Props) {
  const tFields = useTranslations('case.fields');
  const tBlocker = useTranslations('case.blocker');
  const tInsurance = useTranslations('case.insurance');
  const tc = useTranslations('common');

  const [localCase, setLocalCase] = useState<LocalCase>(initial);
  const [localFee, setLocalFee] = useState<number | null>(initialFeeAmount);

  // Re-sync fee from prop on revalidation (e.g. another admin tab updated it).
  const [feeRef, setFeeRef] = useState<number | null>(initialFeeAmount);
  if (initialFeeAmount !== feeRef) {
    setFeeRef(initialFeeAmount);
    setLocalFee(initialFeeAmount);
  }

  // "Fee paid" checkbox state (manager-only). Stamps fee_paid_at on check.
  const [localPaid, setLocalPaid] = useState<boolean>(initialFeePaid);
  const [localPaidAt, setLocalPaidAt] = useState<string | null>(initialFeePaidAt);
  const [paidRef, setPaidRef] = useState<boolean>(initialFeePaid);
  if (initialFeePaid !== paidRef) {
    setPaidRef(initialFeePaid);
    setLocalPaid(initialFeePaid);
    setLocalPaidAt(initialFeePaidAt);
  }

  const savePaid = (checked: boolean) => {
    const prevPaid = localPaid;
    const prevAt = localPaidAt;
    setLocalPaid(checked);
    setLocalPaidAt(checked ? new Date().toISOString() : null);
    void updateCaseFeePaidAction(caseId, checked).then((res) => {
      if (!res.ok) {
        setLocalPaid(prevPaid);
        setLocalPaidAt(prevAt);
        toast.error(tc('saveFailed'));
      } else {
        setLocalPaidAt(res.paidAt);
      }
    });
  };

  const saveFee = async (
    value: string | null,
  ): Promise<{ ok: true } | { ok: false; message?: string }> => {
    const prev = localFee;
    const coerced =
      value === null || value === '' ? null : Number(value);
    setLocalFee(coerced);
    const result = await updateCaseFeeAmountAction(caseId, value);
    if (!result.ok) {
      setLocalFee(prev);
      return { ok: false, message: result.message };
    }
    return { ok: true };
  };

  const saveField = async (
    field: EditableCaseField,
    value: string | null,
  ): Promise<{ ok: true } | { ok: false; message?: string }> => {
    if (!isEditableCaseField(field)) return { ok: false };
    // Cast to LocalCase keys — saveField is only ever called with the
    // admin-section fields below, all of which exist on LocalCase. The
    // wider EditableCaseField type lets us share the action contract
    // with the property block.
    const key = field as keyof LocalCase;
    const prev = localCase[key];

    setLocalCase((c) => ({ ...c, [key]: value as never }));
    const result = await updateCaseFieldAction(caseId, field, value);
    if (!result.ok) {
      setLocalCase((c) => ({ ...c, [key]: prev as never }));
      return { ok: false, message: result.message };
    }
    return { ok: true };
  };

  const advisorOptions = advisors.map((a) => ({
    value: a.id,
    label:
      formatPersonName(a.first_name, a.last_name) || tc('noName'),
  }));
  const blockerOptions = CASE_BLOCKER_VALUES.map((v) => ({
    value: v,
    label: tBlocker(v),
  }));
  const insuranceOptions = INSURANCE_STATUS_VALUES.map((v) => ({
    value: v,
    label: tInsurance(v),
  }));

  return (
    <>
    <FieldGroup cols={4}>
      {/* Status uses the same colored-pill cell as the action bar +
          dashboard so the case-page reads consistently. */}
      <LabeledCell label={tFields('status')}>
        <EditableStatusCell
          caseId={caseId}
          currentStatusId={localCase.status_id}
          currentStatusName={statusName}
          currentStatusColor={statusColor}
          options={statuses.map((s) => ({
            id: s.id,
            name_he: s.name_he,
            color: s.color,
          }))}
        />
      </LabeledCell>
      <EditableField
        type="select"
        label={tFields('blocker')}
        value={localCase.case_blocker}
        options={blockerOptions}
        onSave={(v) => saveField('case_blocker', v)}
      />
      <EditableField
        type="select"
        label={tFields('advisor')}
        value={localCase.assigned_advisor_id}
        options={advisorOptions}
        onSave={(v) => saveField('assigned_advisor_id', v)}
      />
      {/* Row 1 closes with הופנה ע״י (moved up from row 2). Row 2 opens
          with ביטוחים (moved down) so the most-used referrer is at first
          glance alongside status/blocker/advisor. */}
      <EditableField
        label={tFields('referrer')}
        value={localCase.referrer_name}
        onSave={(v) => saveField('referrer_name', v)}
      />
      <EditableField
        type="select"
        label={tFields('insurance')}
        value={localCase.insurance_status}
        options={insuranceOptions}
        onSave={(v) => saveField('insurance_status', v)}
      />
      <EditableField
        label={tFields('insuranceAgent')}
        value={localCase.insurance_agent_name}
        onSave={(v) => saveField('insurance_agent_name', v)}
      />
      <EditableField
        label={tFields('appraiser')}
        value={localCase.appraiser_name}
        onSave={(v) => saveField('appraiser_name', v)}
      />
      <EditableField
        type="date"
        label={tFields('targetDate')}
        value={localCase.target_date}
        onSave={(v) => saveField('target_date', v)}
      />
      {/* Manager-only agreed-fee + a "paid" checkbox (case_financials,
          RLS-gated). The checkbox stamps fee_paid_at on check. */}
      {canSeeFinancials && (
        <>
          <EditableField
            type="number"
            label={tFields('feeAmount')}
            value={localFee == null ? null : String(localFee)}
            onSave={(v) => saveFee(v)}
            dir="ltr"
            adornment={<CurrencySign />}
            groupThousands
          />
          <label className="inline-flex items-center gap-2 self-center text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={localPaid}
              onChange={(e) => savePaid(e.target.checked)}
              className="size-4 rounded border-neutral-300 accent-brand-gold-text cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            />
            <span className="text-neutral-700">{tFields('feePaid')}</span>
            {localPaid && localPaidAt && (
              <span className="text-xs text-neutral-400">
                {new Date(localPaidAt).toLocaleDateString()}
              </span>
            )}
          </label>
        </>
      )}
      {/* Short note last + spans 2 columns so it gets the biggest visual
          slot in the row (the dashboard surfaces this same field — give
          it room to breathe), but not a full-width row of its own. */}
      <div className="sm:col-span-2">
        <EditableField
          label={tFields('shortNote')}
          value={localCase.short_note}
          onSave={(v) => saveField('short_note', v)}
          placeholder={tFields('shortNotePlaceholder')}
        />
      </div>
    </FieldGroup>
    <div className="mt-3 border-t border-neutral-100 pt-3">
      <AssociatedAdvisorsField
        caseId={caseId}
        associatedIds={associatedAdvisorIds}
        responsibleId={localCase.assigned_advisor_id}
        advisorOptions={advisors}
        canManage={canManageAdvisors}
      />
    </div>
    </>
  );
}

/**
 * Wrap a non-EditableField cell (e.g. EditableStatusCell, EditableBankCell)
 * so its label aligns visually with the EditableField rows next to it in
 * the same FieldGroup. Same 6rem label column + flex-1 content column.
 */
function LabeledCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
      <span className="text-neutral-500 truncate">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}
