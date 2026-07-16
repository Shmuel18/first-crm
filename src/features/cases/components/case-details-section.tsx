'use client';

import { useTranslations } from 'next-intl';

import { CurrencySign } from '@/components/ui/currency-sign';
import { formatPersonName } from '@/lib/utils/person-name';

import { FieldGroup } from '@/features/borrowers/components/borrower-compact-fields';
import { EditableField } from '@/features/borrowers/components/editable-field';

import { useCaseDetailsState, type LocalCase } from '../hooks/use-case-details-state';
import {
  CASE_BLOCKER_VALUES,
  INSURANCE_STATUS_VALUES,
} from '../schemas/case.schema';
import type {
  AdvisorOption,
  StatusOption,
} from '../services/case-lookups.service';

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
  /** General case-edit authority (can_edit_case). Gates the plain fields
   *  (blocker / insurance / appraiser / target-date / referrer / note / fee). */
  canEdit: boolean;
  /** can_edit_case AND change_case_status — gates the inline status cell. */
  canChangeStatus: boolean;
  /** can_edit_case AND assign_case_to_user — gates the responsible-advisor cell. */
  canAssignAdvisor: boolean;
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
  canEdit,
  canChangeStatus,
  canAssignAdvisor,
  canSeeFinancials,
  initialFeeAmount,
  initialFeePaid,
  initialFeePaidAt,
}: Props) {
  const tFields = useTranslations('case.fields');
  const tBlocker = useTranslations('case.blocker');
  const tInsurance = useTranslations('case.insurance');
  const tc = useTranslations('common');

  // All optimistic field state + saves live in the hook, which also wires
  // the background router-cache refresh (stale back/forward payloads were
  // reverting and even overwriting saved values — see the hook doc).
  const { localCase, localFee, localPaid, localPaidAt, saveField, saveFee, savePaid } =
    useCaseDetailsState(caseId, initial, initialFeeAmount, initialFeePaid, initialFeePaidAt);

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
          canEdit={canChangeStatus}
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
        canEdit={canEdit}
      />
      <EditableField
        type="select"
        label={tFields('advisor')}
        value={localCase.assigned_advisor_id}
        options={advisorOptions}
        onSave={(v) => saveField('assigned_advisor_id', v)}
        canEdit={canAssignAdvisor}
      />
      {/* Associated advisors sit directly beside the responsible advisor
          (migration 146) — a cell in the same row, not a separate row.
          Referrer moved down next to the agreed fee (office preference). */}
      <AssociatedAdvisorsField
        caseId={caseId}
        associatedIds={associatedAdvisorIds}
        responsibleId={localCase.assigned_advisor_id}
        advisorOptions={advisors}
        canManage={canManageAdvisors}
      />
      <EditableField
        type="select"
        label={tFields('insurance')}
        value={localCase.insurance_status}
        options={insuranceOptions}
        onSave={(v) => saveField('insurance_status', v)}
        canEdit={canEdit}
      />
      <EditableField
        label={tFields('insuranceAgent')}
        value={localCase.insurance_agent_name}
        onSave={(v) => saveField('insurance_agent_name', v)}
        canEdit={canEdit}
      />
      <EditableField
        label={tFields('appraiser')}
        value={localCase.appraiser_name}
        onSave={(v) => saveField('appraiser_name', v)}
        canEdit={canEdit}
      />
      <EditableField
        type="date"
        label={tFields('targetDate')}
        value={localCase.target_date}
        onSave={(v) => saveField('target_date', v)}
        canEdit={canEdit}
      />
      {/* הופנה ע״י — placed next to the agreed fee per the office layout. */}
      <EditableField
        label={tFields('referrer')}
        value={localCase.referrer_name}
        onSave={(v) => saveField('referrer_name', v)}
        canEdit={canEdit}
      />
      {/* Manager-only agreed-fee. The "שולם" checkbox rides inside the field as
          a compact adornment (not its own column) so it stays small and frees a
          column for the note to sit on this row (case_financials, RLS-gated). */}
      {canSeeFinancials && (
        <EditableField
          type="number"
          label={tFields('feeAmount')}
          value={localFee == null ? null : String(localFee)}
          onSave={(v) => saveFee(v)}
          dir="ltr"
          groupThousands
          canEdit={canEdit}
          adornment={
            <span className="flex items-center gap-1.5">
              <CurrencySign />
              <label
                className="inline-flex items-center gap-1 cursor-pointer text-xs text-neutral-600"
                title={
                  localPaid && localPaidAt
                    ? new Date(localPaidAt).toLocaleDateString()
                    : tFields('feePaid')
                }
              >
                <input
                  type="checkbox"
                  checked={localPaid}
                  onChange={(e) => savePaid(e.target.checked)}
                  disabled={!canEdit}
                  aria-label={tFields('feePaid')}
                  className="size-3.5 rounded border-neutral-300 accent-brand-gold-text cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
                />
                {tFields('feePaid')}
              </label>
            </span>
          }
        />
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
          canEdit={canEdit}
        />
      </div>
    </FieldGroup>
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
