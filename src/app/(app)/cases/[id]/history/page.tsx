import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { AuditLogTable } from '@/features/audit/components/audit-log-table';
import { listAuditEntriesForCase } from '@/features/audit/services/audit.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string }> };

export default async function CaseHistoryPage({ params }: Props) {
  const { id } = await params;
  const caseId = asCaseId(id);
  const caseData = await getCaseById(caseId);
  if (!caseData) notFound();

  const t = await getTranslations('case');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());
  const entries = await listAuditEntriesForCase(caseId);

  // Show the primary borrower's name in the header (more useful at a glance
  // than the internal case number, which the user can't memorise anyway).
  const primaryBorrower = caseData.case_borrowers?.find((cb) => cb.is_primary)?.borrower;
  const borrowerName = primaryBorrower
    ? [primaryBorrower.first_name, primaryBorrower.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || tc('noName')
    : tc('noName');

  return (
    <div className="space-y-5 -mt-6">
      <div className="bg-brand-gold-soft text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 -mx-4 border-b border-brand-gold/20 px-4 py-3 shadow-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/cases/${caseData.id}`}
            aria-label={tc('back')}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white/60 text-neutral-700 transition hover:border-brand-gold-text hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
          >
            <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold">{t('history.title')}</span>
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
