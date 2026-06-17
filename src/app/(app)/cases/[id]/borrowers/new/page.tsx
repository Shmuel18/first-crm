import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { BorrowerForm } from '@/features/borrowers/components/borrower-form';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { userCanEditCase } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string }> };

export default async function NewBorrowerPage({ params }: Props) {
  const { id } = await params;
  const caseData = await getRawCaseById(asCaseId(id));
  if (!caseData) notFound();
  // A user who can VIEW the case but not EDIT it (e.g. a secretary with
  // view_all on an unassigned case) must not be shown the editable form —
  // the write is server-blocked anyway, so this keeps the UI honest. Matches
  // the case-detail page gate (can_edit_case, migration 147).
  if (!(await userCanEditCase(asCaseId(id)))) notFound();

  const t = await getTranslations('case');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/cases/${id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <BackArrow locale={locale} className="size-4" />
          {tc('back')}
        </Link>
        <h1 className="text-2xl font-light text-neutral-900 font-mono">
          {t('blocks.addBorrower')} · {t('actionBar.caseLabel')} {caseData.case_number}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <BorrowerForm caseId={id} />
      </div>
    </div>
  );
}
