import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { AuditLogTable } from '@/features/audit/components/audit-log-table';
import { listAuditEntriesForCase } from '@/features/audit/services/audit.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import type { Locale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string }> };

export default async function CaseHistoryPage({ params }: Props) {
  const { id } = await params;
  const caseId = asCaseId(id);
  const caseData = await getCaseById(caseId);
  if (!caseData) notFound();

  const t = await getTranslations('case');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) as Locale;
  const entries = await listAuditEntriesForCase(caseId);

  return (
    <div className="space-y-5 -mt-6">
      <div className="bg-[#FAF8F3] text-neutral-900 sticky top-16 z-20 -mx-6 border-b border-[#C9A961]/20 px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/cases/${caseData.id}`}
            title={tc('back')}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white/60 text-neutral-600 transition hover:border-[#C9A961] hover:text-[#C9A961]"
          >
            <BackArrow locale={locale} className="size-3.5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold">{t('history.title')}</span>
            <span className="text-neutral-300">·</span>
            <span className="font-mono text-sm text-[#C9A961]">
              {t('actionBar.caseLabel')} {caseData.case_number}
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <AuditLogTable entries={entries} />
      </div>
    </div>
  );
}
