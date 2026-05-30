import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { AuditLogTable } from '@/features/audit/components/audit-log-table';
import { listAuditEntriesForCase, listDocumentAuditForCase } from '@/features/audit/services/audit.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string }>;
};

export default async function CaseHistoryPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { scope } = await searchParams;
  const documentsOnly = scope === 'documents';
  const caseId = asCaseId(id);
  const caseData = await getCaseById(caseId);
  if (!caseData) notFound();

  const t = await getTranslations('case');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());
  // Documents view: just this case's document audit. Full view: the whole-case
  // timeline, with manager-only financials gated behind view_case_fee.
  const entries = documentsOnly
    ? await listDocumentAuditForCase(caseId)
    : await listAuditEntriesForCase(caseId, undefined, {
        includeFinancials: await userHasPermission('view_case_fee'),
      });

  // Show the primary borrower's name in the header (more useful at a glance
  // than the internal case number, which the user can't memorise anyway).
  const primaryBorrower = caseData.case_borrowers?.find((cb) => cb.is_primary)?.borrower;
  const borrowerName = primaryBorrower
    ? formatPersonName(primaryBorrower.first_name, primaryBorrower.last_name) || tc('noName')
    : tc('noName');

  return (
    <div className="space-y-5 -mt-6">
      <div className="bg-brand-gold-soft text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 -mx-4 border-b border-brand-gold/20 px-4 py-3 shadow-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={documentsOnly ? `/cases/${caseData.id}/documents` : `/cases/${caseData.id}`}
            aria-label={tc('back')}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white/60 text-neutral-700 transition hover:border-brand-gold-text hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
          >
            <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold">{documentsOnly ? t('history.documentsTitle') : t('history.title')}</span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span className="text-sm text-brand-gold-text font-medium">{borrowerName}</span>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <AuditLogTable entries={entries} />
      </div>
    </div>
  );
}
