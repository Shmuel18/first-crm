import { Coins, Landmark, Receipt, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { CaseBanksInlineList, type CaseBankRowData } from '@/features/case-banks/components/case-banks-inline-list';
import { listBankOptions } from '@/features/case-banks/services/case-banks.service';
import { CaseExpensesList } from '@/features/case-expenses/components/case-expenses-list';
import { listCaseExpenses } from '@/features/case-expenses/services/case-expenses.service';
import { CasePayoutsList } from '@/features/case-payouts/components/case-payouts-list';
import { listCasePayouts } from '@/features/case-payouts/services/case-payouts.service';
import type { Locale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { formatDateShort } from '@/lib/utils/format-date';

import type { CaseBlocker, InsuranceStatus } from '../schemas/case.schema';
import type {
  AdvisorOption,
  StatusOption,
} from '../services/case-lookups.service';

import { CaseBlock } from './case-block';
import { CaseDetailsSection } from './case-details-section';

type Props = {
  caseId: string;
  /** Initial case-row fields shown in the "case details" sub-section. */
  statusId: string | null;
  /** Live status name + color for the EditableStatusCell badge. */
  statusName: string | null;
  statusColor: string | null;
  assignedAdvisorId: string | null;
  blocker: CaseBlocker | null;
  insurance: InsuranceStatus | null;
  insuranceAgentName: string | null;
  appraiserName: string | null;
  targetDate: string | null;
  referrerName: string | null;
  shortNote: string | null;
  /** Case opening date (cases.created_at) — shown read-only for the record. */
  createdAt: string;
  /** All active case_banks rows (with bank + banker_name) for the inline
   *  banks list inside the admin block. */
  bankRows: ReadonlyArray<CaseBankRowData>;
  /** Manager-only agreed-fee. Already filtered by the page based on
   *  canSeeFinancials — non-managers receive null and the field hides. */
  canSeeFinancials: boolean;
  feeAmount: number | null;
  feePaid: boolean;
  feePaidAt: string | null;
  /** Lookups passed down from the page. */
  statuses: ReadonlyArray<StatusOption>;
  advisors: ReadonlyArray<AdvisorOption>;
  /** Associated advisors (migration 146) + whether the user may edit them. */
  associatedAdvisorIds: ReadonlyArray<string>;
  canManageAdvisors: boolean;
  /** General case-edit authority (can_edit_case). Gates the case-details
   *  fields, the banks list, and the office-expenses table. */
  canEdit: boolean;
  /** can_edit_case AND change_case_status / assign_case_to_user. */
  canChangeStatus: boolean;
  canAssignAdvisor: boolean;
  locale: Locale;
};

/**
 * Administrative case info block. Three sub-sections:
 *
 *   1. פרטי התיק (Case Details) — 8 inline-editable fields rendered by
 *      CaseDetailsSection (status / blocker / primary bank / advisor /
 *      insurance / short note / referrer / agreed fee).
 *   2. בנקים (Banks) — inline list of case_banks rows.
 *   3. הוצאות משרד (Office Expenses) — inline table backed by
 *      case_expenses (migration 081).
 *
 * Manager-only fee_amount is gated behind canSeeFinancials at the prop
 * level (defense-in-depth alongside case_financials RLS). Tasks moved
 * out of this block into the action-bar popover so the page has a single
 * top-level entry point for the case's open tasks.
 */
export async function CaseAdminBlock({
  caseId,
  statusId,
  statusName,
  statusColor,
  assignedAdvisorId,
  blocker,
  insurance,
  insuranceAgentName,
  appraiserName,
  targetDate,
  referrerName,
  shortNote,
  createdAt,
  bankRows,
  canSeeFinancials,
  feeAmount,
  feePaid,
  feePaidAt,
  statuses,
  advisors,
  associatedAdvisorIds,
  canManageAdvisors,
  canEdit,
  canChangeStatus,
  canAssignAdvisor,
  locale,
}: Props) {
  const t = await getTranslations('case');
  const tAdmin = await getTranslations('case.admin');

  // Server-side fetches: bank lookup + this case's expenses. Both are
  // cheap and tightly scoped, so we don't pull them up to the page.
  // Payouts (commissions/salaries) are manager-only — skip the query entirely
  // for non-managers (RLS would return [] anyway; this avoids the roundtrip).
  const [banks, expenses, payouts] = await Promise.all([
    listBankOptions(),
    listCaseExpenses(asCaseId(caseId)),
    canSeeFinancials ? listCasePayouts(asCaseId(caseId)) : Promise.resolve([]),
  ]);

  return (
    <CaseBlock title={t('blocks.admin')} icon={<Wallet />} fullWidth blockKey="admin">
      {/* Section 1 — Case details (8 inline fields). */}
      <SectionHeader title={tAdmin('sections.caseDetails')} />
      <p className="pb-2 pt-2 text-xs text-neutral-500">
        {tAdmin('openedAt')}:{' '}
        <span className="font-medium text-neutral-700 tabular-nums">
          {formatDateShort(createdAt, locale)}
        </span>
      </p>
      <CaseDetailsSection
        caseId={caseId}
        initial={{
          status_id: statusId,
          assigned_advisor_id: assignedAdvisorId,
          case_blocker: blocker,
          insurance_status: insurance,
          insurance_agent_name: insuranceAgentName,
          appraiser_name: appraiserName,
          target_date: targetDate,
          referrer_name: referrerName,
          short_note: shortNote,
        }}
        statusName={statusName}
        statusColor={statusColor}
        statuses={statuses}
        advisors={advisors}
        associatedAdvisorIds={associatedAdvisorIds}
        canManageAdvisors={canManageAdvisors}
        canEdit={canEdit}
        canChangeStatus={canChangeStatus}
        canAssignAdvisor={canAssignAdvisor}
        canSeeFinancials={canSeeFinancials}
        initialFeeAmount={feeAmount}
        initialFeePaid={feePaid}
        initialFeePaidAt={feePaidAt}
      />

      {/* Sections 2 + 3 — Banks and Office expenses side-by-side on
          desktop (each is a short list, no need to claim full width),
          stacked on mobile. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 pt-2">
        <div>
          <SectionHeader title={tAdmin('sections.banks')} icon={<Landmark />} />
          <CaseBanksInlineList
            caseId={caseId}
            rows={bankRows}
            banks={banks}
            canEdit={canEdit}
          />
        </div>
        <div>
          <SectionHeader title={tAdmin('sections.officeExpenses')} icon={<Receipt />} />
          <CaseExpensesList caseId={caseId} expenses={expenses} canEdit={canEdit} />
        </div>
      </div>

      {/* Section 4 — Commissions & salaries (MANAGER-ONLY). Sits with the
          fee it's paid out of; gated by canSeeFinancials at the prop level
          (defense-in-depth alongside the case_payouts is_admin() RLS). */}
      {canSeeFinancials && (
        <div className="pt-2">
          <SectionHeader title={tAdmin('sections.payouts')} icon={<Coins />} />
          <CasePayoutsList caseId={caseId} payouts={payouts} canEdit={canEdit} />
        </div>
      )}
    </CaseBlock>
  );
}

function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-5 first:pt-0 pb-2 border-b border-neutral-100">
      {icon && (
        <span aria-hidden="true" className="text-brand-gold-text [&_svg]:size-4">
          {icon}
        </span>
      )}
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
    </div>
  );
}
