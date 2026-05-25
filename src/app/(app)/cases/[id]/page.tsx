import { Suspense } from 'react';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Briefcase,
  FileText,
  FolderArchive,
  Home,
  Pencil,
  Receipt,
  UserCircle2,
  Wallet,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBorrowerCard } from '@/features/borrowers/components/case-borrower-card';
import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import {
  CaseBanksBlock,
  CaseBanksBlockSkeleton,
} from '@/features/case-banks/components/case-banks-block';
import { CaseActionBar } from '@/features/cases/components/case-action-bar';
import { CaseAdminBlock } from '@/features/cases/components/case-admin-block';
import { CaseBlock } from '@/features/cases/components/case-block';
import { CaseBlockSkeleton } from '@/features/cases/components/case-block-skeleton';
import { bandToAccent, EmptyBorrowers } from '@/features/cases/components/case-detail-helpers';
import { DataRow } from '@/features/cases/components/case-info-rows';
import { calculateLtv, ltvBand } from '@/features/cases/domain/calculations';
import { formatMoney } from '@/features/cases/domain/format';
import type { CaseBlocker, InsuranceStatus } from '@/features/cases/schemas/case.schema';
import { listCaseStatusOptions } from '@/features/cases/services/case-lookups.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { CaseIncomesBlock } from '@/features/incomes/components/case-incomes-block';
import { CaseObligationsBlock } from '@/features/obligations/components/case-obligations-block';
import { CaseTasksBlock } from '@/features/tasks/components/case-tasks-block';
import { userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';

type Props = { params: Promise<{ id: string }> };

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params;

  const t = await getTranslations('case');
  const tc = await getTranslations('common');

  const caseId = asCaseId(id);

  // Eager fetches block first paint: the action bar needs the case + status
  // options, and the borrowers list feeds the header's client-name display.
  // Banks, incomes, obligations, and tasks all stream in below via <Suspense>.
  const [caseData, borrowers, statusOptions] = await Promise.all([
    getCaseById(caseId),
    listBorrowersForCase(caseId),
    listCaseStatusOptions(),
  ]);

  if (!caseData) notFound();

  // Use the same permission gate as the case_financials RLS policy (#27).
  // Previously this was isCurrentUserAdmin(), which meant a non-admin with
  // view_case_fee saw an empty UI block — but the fee_amount + expected_income
  // values were still loaded by getCaseById and shipped down in the RSC
  // payload, readable via view-source. Aligning the gate closes the leak.
  const [canSeeFinancials, canArchive, canRestore] = await Promise.all([
    userHasPermission('view_case_fee'),
    userHasPermission('archive_case'),
    userHasPermission('restore_archived_case'),
  ]);

  const borrowerNames =
    borrowers
      .map(({ borrower }) =>
        [borrower.first_name, borrower.last_name].filter(Boolean).join(' '),
      )
      .filter(Boolean)
      .join(' & ') || '';

  const advisor =
    [caseData.assigned_advisor?.first_name, caseData.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ') || `— ${tc('notAssigned')}`;

  const ltv = calculateLtv(caseData.property_value, caseData.requested_mortgage_amount);
  const ltvAccent = ltv !== null ? bandToAccent(ltvBand(ltv)) : undefined;

  const locale = parseLocale(await getLocale());

  return (
    <div className="space-y-5 -mt-6">
      <CaseActionBar
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        createdAt={caseData.created_at}
        statusId={caseData.status?.id ?? null}
        statusName={caseData.status?.name_he ?? null}
        statusColor={caseData.status?.color ?? null}
        statusOptions={statusOptions}
        caseTypePrimary={caseData.case_type_primary?.name_he ?? null}
        caseTypeSecondary={caseData.case_type_secondary?.name_he ?? null}
        borrowerNames={borrowerNames}
        isArchived={caseData.is_archived}
        canArchive={canArchive}
        canRestore={canRestore}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CaseBlock
          title={`${t('blocks.borrowers')} ${borrowers.length > 0 ? `(${borrowers.length})` : ''}`}
          icon={<UserCircle2 />}
          fullWidth
          rightSlot={
            <Link
              href={`/cases/${caseData.id}/borrowers/new`}
              className="text-xs text-[#A88840] hover:underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40"
            >
              {t('blocks.addBorrower')}
            </Link>
          }
        >
          {borrowers.length === 0 ? (
            <EmptyBorrowers
              caseId={caseData.id}
              emptyText={t('blocks.noBorrowers')}
              ctaText={t('blocks.addBorrowerFirst')}
            />
          ) : (
            // Borrowers stacked vertically (not side-by-side) so each card
            // gets full block width and inner fields can pair without
            // cramping. Was md:grid-cols-2 — at ~400px per card the dates
            // + adornments didn't fit cleanly.
            <div className="space-y-4">
              {borrowers.map(({ borrower, role_in_case, is_primary }) => (
                <CaseBorrowerCard
                  key={borrower.id}
                  caseId={caseData.id}
                  borrower={borrower}
                  roleInCase={role_in_case}
                  isPrimary={is_primary}
                />
              ))}
            </div>
          )}
        </CaseBlock>

        <Suspense fallback={<CaseBlockSkeleton title={t('blocks.incomes')} icon={<Wallet />} />}>
          <CaseIncomesBlock caseId={caseData.id} />
        </Suspense>

        <Suspense
          fallback={<CaseBlockSkeleton title={t('blocks.obligations')} icon={<Receipt />} />}
        >
          <CaseObligationsBlock caseId={caseData.id} />
        </Suspense>

        <CaseBlock title={t('blocks.property')} icon={<Home />}>
          <DataRow label={t('fields.propertyValue')} value={formatMoney(caseData.property_value)} large />
          <DataRow
            label={t('fields.requestedMortgageAmount')}
            value={formatMoney(caseData.requested_mortgage_amount)}
            large
          />
          <DataRow label={t('fields.equity')} value={formatMoney(caseData.equity)} />
          {ltv !== null && (
            <DataRow label={t('fields.ltv')} value={`${ltv.toFixed(1)}%`} accent={ltvAccent} />
          )}
        </CaseBlock>

        <Suspense fallback={<CaseBanksBlockSkeleton />}>
          <CaseBanksBlock caseId={caseData.id} />
        </Suspense>

        {/* blocker/insurance are CHECK-constrained DB strings; narrow to unions. */}
        <CaseAdminBlock
          blocker={caseData.case_blocker as CaseBlocker | null}
          insurance={caseData.insurance_status as InsuranceStatus | null}
          referrerName={caseData.referrer_name}
          advisor={advisor}
          createdAt={caseData.created_at}
          // Defense in depth: even if RLS lets the row through, never ship
          // the numbers to the client when the UI is going to hide them.
          feeAmount={canSeeFinancials ? caseData.case_financials?.fee_amount ?? null : null}
          expectedIncome={
            canSeeFinancials ? caseData.case_financials?.expected_income ?? null : null
          }
          canSeeFinancials={canSeeFinancials}
          locale={locale}
        />

        <CaseBlock title={t('blocks.tasks')} icon={<Briefcase />}>
          <Suspense fallback={<TasksBlockInlineSkeleton />}>
            <CaseTasksBlock caseId={caseData.id} locale={locale} />
          </Suspense>
        </CaseBlock>

        <CaseBlock title={t('blocks.shortNote')} icon={<Briefcase />} fullWidth>
          {caseData.short_note ? (
            <p className="text-sm text-neutral-800 leading-relaxed">{caseData.short_note}</p>
          ) : (
            <p className="text-sm text-neutral-600 italic">{t('blocks.shortNoteEmpty')}</p>
          )}
        </CaseBlock>

        <CaseBlock title={t('blocks.requestDetails')} icon={<FileText />} fullWidth>
          {caseData.request_details ? (
            <div
              className="tiptap-content text-neutral-700"
              // Defense-in-depth: even though create/update actions sanitize
              // before INSERT, re-sanitize on read so older rows or any future
              // bypass (studio writes, audit replays, imports) can't XSS.
              dangerouslySetInnerHTML={{
                __html: sanitizeRichTextHtml(caseData.request_details),
              }}
            />
          ) : (
            <p className="text-sm text-neutral-600 italic">
              {t('blocks.requestDetailsEmpty')}
            </p>
          )}
        </CaseBlock>

        <CaseBlock
          title={t('blocks.documents')}
          icon={<FolderArchive />}
          fullWidth
          rightSlot={
            <Link
              href={`/cases/${caseData.id}/documents`}
              className="text-xs text-[#A88840] hover:underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40"
            >
              {t('blocks.openDocuments')}
            </Link>
          }
        >
          <p className="text-sm text-neutral-600 text-center py-4">
            {t('blocks.documentsHint')}
          </p>
        </CaseBlock>
      </div>

      <div className="text-center text-xs text-neutral-600 pt-4">
        <Link
          href={`/cases/${caseData.id}/edit`}
          className="inline-flex items-center gap-1 hover:text-[#A88840] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 transition"
        >
          <Pencil className="size-3" aria-hidden="true" />
          {tc('edit')}
        </Link>
      </div>
    </div>
  );
}

// Inline skeleton for the tasks block — it's nested inside an existing
// <CaseBlock>, so we only render the row placeholders, not the chrome.
function TasksBlockInlineSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden>
      <div className="h-12 rounded-lg bg-neutral-100" />
      <div className="h-12 rounded-lg bg-neutral-100" />
      <div className="h-12 rounded-lg bg-neutral-100" />
    </div>
  );
}

