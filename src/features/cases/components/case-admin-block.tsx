import { Landmark, Receipt, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { CaseBanksInlineList, type CaseBankRowData } from '@/features/case-banks/components/case-banks-inline-list';
import { listBankOptions } from '@/features/case-banks/services/case-banks.service';
import { CaseExpensesList } from '@/features/case-expenses/components/case-expenses-list';
import { listCaseExpenses } from '@/features/case-expenses/services/case-expenses.service';
import type { Locale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

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
  /** All active case_banks rows (with bank + banker_name) for the inline
   *  banks list inside the admin block. */
  bankRows: ReadonlyArray<CaseBankRowData>;
  /** Manager-only agreed-fee. Already filtered by the page based on
   *  canSeeFinancials — non-managers receive null and the field hides. */
  canSeeFinancials: boolean;
  feeAmount: number | null;
  /** Lookups passed down from the page. */
  statuses: ReadonlyArray<StatusOption>;
  advisors: ReadonlyArray<AdvisorOption>;
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
  bankRows,
  canSeeFinancials,
  feeAmount,
  statuses,
  advisors,
  locale,
}: Props) {
  const t = await getTranslations('case');
  const tAdmin = await getTranslations('case.admin');
  void locale; // reserved for future locale-aware formatting

  // Server-side fetches: bank lookup + this case's expenses. Both are
  // cheap and tightly scoped, so we don't pull them up to the page.
  const [banks, expenses] = await Promise.all([
    listBankOptions(),
    listCaseExpenses(asCaseId(caseId)),
  ]);

  return (
    <CaseBlock title={t('blocks.admin')} icon={<Wallet />} fullWidth blockKey="admin">
      {/* Section 1 — Case details (8 inline fields). */}
      <SectionHeader title={tAdmin('sections.caseDetails')} />
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
        canSeeFinancials={canSeeFinancials}
        initialFeeAmount={feeAmount}
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
            canEdit
          />
        </div>
        <div>
          <SectionHeader title={tAdmin('sections.officeExpenses')} icon={<Receipt />} />
          <CaseExpensesList caseId={caseId} expenses={expenses} canEdit />
        </div>
      </div>
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
