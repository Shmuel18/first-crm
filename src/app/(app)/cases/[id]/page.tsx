import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { MessagesSquare, Receipt, UserCircle2, Wallet } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBorrowerCard } from '@/features/borrowers/components/case-borrower-card';
import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { CaseCommentsBlock } from '@/features/case-comments/components/case-comments-block';
import { CaseActionBar } from '@/features/cases/components/case-action-bar';
import { CaseAdminBlock } from '@/features/cases/components/case-admin-block';
import { CaseBlock } from '@/features/cases/components/case-block';
import { CaseBlockPrefsProvider } from '@/features/cases/components/case-block-prefs-context';
import { CaseBlockSkeleton } from '@/features/cases/components/case-block-skeleton';
import { AddBorrowerButton } from '@/features/borrowers/components/add-borrower-button';
import { CasePropertyBlock } from '@/features/cases/components/case-property-block';
import { CaseRequestDetailsBlock } from '@/features/cases/components/case-request-details-block';
import type { CaseBlocker, InsuranceStatus } from '@/features/cases/schemas/case.schema';
import {
  listAdvisorOptions,
  listCaseStatusOptions,
  listCaseTypeOptions,
} from '@/features/cases/services/case-lookups.service';
import { getMyCaseBlockPreferences } from '@/features/cases/services/case-block-preferences.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { CaseIncomesBlock } from '@/features/incomes/components/case-incomes-block';
import { CaseObligationsBlock } from '@/features/obligations/components/case-obligations-block';
import { userHasPermissions } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { timeAsync } from '@/lib/perf/timing';
import { asCaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

type Props = { params: Promise<{ id: string }> };

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params;

  const t = await getTranslations('case');
  const tComments = await getTranslations('caseComments');

  const caseId = asCaseId(id);

  // Eager fetches block first paint: the action bar needs the case + status
  // options, and the borrowers list feeds the header's client-name display.
  // Incomes and obligations stream in below via <Suspense>; tasks are
  // fetched by the action bar for the new top-of-page popover.
  const [caseData, borrowers, statusOptions, caseTypeOptions, advisorOptions, blockPrefs] =
    await Promise.all([
      timeAsync('cases.detail.getCaseById', () => getCaseById(caseId)),
      timeAsync('cases.detail.listBorrowersForCase', () => listBorrowersForCase(caseId)),
      timeAsync('cases.detail.listCaseStatusOptions', () => listCaseStatusOptions()),
      timeAsync('cases.detail.listCaseTypeOptions', () => listCaseTypeOptions()),
      timeAsync('cases.detail.listAdvisorOptions', () => listAdvisorOptions()),
      getMyCaseBlockPreferences(),
    ]);

  if (!caseData) notFound();

  // Use the same permission gate as the case_financials RLS policy (#27).
  // Previously this was isCurrentUserAdmin(), which meant a non-admin with
  // view_case_fee saw an empty UI block — but the fee_amount + expected_income
  // values were still loaded by getCaseById and shipped down in the RSC
  // payload, readable via view-source. Aligning the gate closes the leak.
  // canSeeFinancials gates the manager-only agreed-fee row in the admin
  // block. The DB enforces the same gate via case_financials RLS — this
  // app-side check is for clean UX (hide the row) + defense-in-depth.
  const permissions = await timeAsync(
    'cases.detail.permissions',
    () =>
      userHasPermissions(
        'view_case_fee',
        'archive_case',
        'restore_archived_case',
        'delete_case',
      ),
  );
  const canSeeFinancials = permissions.view_case_fee === true;
  const canArchive = permissions.archive_case === true;
  const canRestore = permissions.restore_archived_case === true;
  const canDelete = permissions.delete_case === true;

  const borrowerNames =
    borrowers
      .map(({ borrower }) => formatPersonName(borrower.first_name, borrower.last_name))
      .filter(Boolean)
      .join(' & ') || '';

  // Primary borrower contact for the action bar's "send message to client"
  // menu (WhatsApp / email). Prefer the flagged primary; fall back to the
  // first borrower for legacy/imported data with no primary flag.
  const primaryRecord = borrowers.find((row) => row.is_primary) ?? borrowers[0];
  const primaryBorrower = primaryRecord
    ? {
        firstName: primaryRecord.borrower.first_name,
        lastName: primaryRecord.borrower.last_name,
        email: primaryRecord.borrower.email,
        phone: primaryRecord.borrower.phone,
      }
    : null;

  // Banks linked to this case — passed to the admin block's inline list.
  // Each row has the bank info + banker_name + is_primary; the list
  // renders one row per bank with inline-edit + delete + primary toggle.
  const bankRows = (caseData.case_banks ?? [])
    .filter((cb) => cb.deleted_at === null)
    .map((cb) => ({
      id: cb.id,
      bank: cb.bank
        ? {
            id: cb.bank.id,
            key: cb.bank.key,
            name_he: cb.bank.name_he,
            color: cb.bank.color,
            logo_url: cb.bank.logo_url,
          }
        : null,
      banker_name: cb.banker_name,
      is_primary: cb.is_primary,
    }));

  const locale = parseLocale(await getLocale());

  return (
    <div className="space-y-5 -mt-6">
      <CaseActionBar
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        statusId={caseData.status?.id ?? null}
        statusName={caseData.status?.name_he ?? null}
        statusColor={caseData.status?.color ?? null}
        statusOptions={statusOptions}
        caseTypePrimary={caseData.case_type_primary?.name_he ?? null}
        caseTypeSecondary={caseData.case_type_secondary?.name_he ?? null}
        borrowerNames={borrowerNames}
        primaryBorrower={primaryBorrower}
        isArchived={caseData.is_archived}
        canArchive={canArchive}
        canRestore={canRestore}
        canDelete={canDelete}
      />

      <CaseBlockPrefsProvider prefs={blockPrefs}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CaseBlock
          title={t('blocks.borrowers')}
          icon={<UserCircle2 />}
          fullWidth
          blockKey="borrowers"
          // RightSlot summary: borrower names instead of a button — aligns
          // with the Incomes / Obligations blocks which surface a money
          // total in the same spot. The "+ Add borrower" button moved
          // inside the block content (visible only when expanded).
          rightSlot={
            borrowerNames ? (
              <span className="text-xs text-neutral-600 truncate max-w-xs">{borrowerNames}</span>
            ) : null
          }
        >
          {borrowers.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-neutral-500">{t('blocks.noBorrowers')}</p>
              <AddBorrowerButton caseId={caseData.id} variant="cta" />
            </div>
          ) : (
            // Borrowers stacked vertically (not side-by-side) so each card
            // gets full block width and inner fields can pair without
            // cramping. Was md:grid-cols-2 — at ~400px per card the dates
            // + adornments didn't fit cleanly.
            <div className="space-y-4">
              <div className="flex justify-end">
                <AddBorrowerButton caseId={caseData.id} variant="header" />
              </div>
              {borrowers.map(({ borrower, role_in_case, is_primary }, index) => (
                <CaseBorrowerCard
                  key={borrower.id}
                  caseId={caseData.id}
                  borrower={borrower}
                  roleInCase={role_in_case}
                  isPrimary={is_primary}
                  // Lock removal on (a) the primary (by data flag) or (b) the
                  // first row in the rendered list. The list is ordered
                  // is_primary DESC, so "first" is the de-facto anchor even
                  // if the data has no row flagged primary (legacy / partial
                  // migrations). Combined with isOnly to never let the user
                  // empty a case.
                  isFirst={index === 0}
                  isOnly={borrowers.length === 1}
                />
              ))}
            </div>
          )}
        </CaseBlock>

        <CaseRequestDetailsBlock
          caseId={caseData.id}
          initialHtml={caseData.request_details}
        />

        <Suspense fallback={<CaseBlockSkeleton title={t('blocks.incomes')} icon={<Wallet />} />}>
          <CaseIncomesBlock caseId={caseData.id} />
        </Suspense>

        <Suspense
          fallback={<CaseBlockSkeleton title={t('blocks.obligations')} icon={<Receipt />} />}
        >
          <CaseObligationsBlock caseId={caseData.id} />
        </Suspense>

        <CasePropertyBlock
          caseId={caseData.id}
          initial={{
            case_type_primary_id: caseData.case_type_primary?.id ?? null,
            case_type_other_text: caseData.case_type_other_text ?? null,
            city: caseData.city ?? null,
            property_value: caseData.property_value,
            requested_mortgage_amount: caseData.requested_mortgage_amount,
          }}
          caseTypes={caseTypeOptions}
        />

        {/* Equity + LTV intentionally removed from this block — they aren't
            in the new product spec for the property card. The equity column
            stays in the DB as nullable so old data isn't dropped. */}

        {/* Admin block owns the case-details fields (status / blocker /
            primary bank / advisor / insurance / short note / referrer /
            fee), the banks list, and the office-expenses table. Tasks
            moved out to the action-bar popover so there's a single
            top-level entry for the case's open tasks.
            blocker/insurance are CHECK-constrained DB strings; narrow to unions. */}
        <CaseAdminBlock
          caseId={caseData.id}
          statusId={caseData.status?.id ?? null}
          statusName={caseData.status?.name_he ?? null}
          statusColor={caseData.status?.color ?? null}
          assignedAdvisorId={caseData.assigned_advisor?.id ?? null}
          blocker={caseData.case_blocker as CaseBlocker | null}
          insurance={caseData.insurance_status as InsuranceStatus | null}
          insuranceAgentName={caseData.insurance_agent_name}
          appraiserName={caseData.appraiser_name}
          targetDate={caseData.target_date}
          referrerName={caseData.referrer_name}
          shortNote={caseData.short_note}
          bankRows={bankRows}
          canSeeFinancials={canSeeFinancials}
          feeAmount={
            // Defense in depth: even if the row is in RAM, don't leak the
            // value down to the client when the UI is going to hide it.
            canSeeFinancials ? caseData.case_financials?.fee_amount ?? null : null
          }
          feePaid={canSeeFinancials ? caseData.case_financials?.fee_paid ?? false : false}
          feePaidAt={
            canSeeFinancials ? caseData.case_financials?.fee_paid_at ?? null : null
          }
          statuses={statusOptions}
          advisors={advisorOptions}
          locale={locale}
        />

        {/* Documentation (internal team thread) — intentionally last on the
            page: it's a running log, not a data-entry block, so it sits below
            the case fields. fullWidth, so it caps the grid as its own row. */}
        <Suspense
          fallback={<CaseBlockSkeleton title={tComments('blockTitle')} icon={<MessagesSquare />} />}
        >
          <CaseCommentsBlock caseId={caseData.id} />
        </Suspense>
      </div>
      </CaseBlockPrefsProvider>

    </div>
  );
}

