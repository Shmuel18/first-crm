import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { BorrowerForm } from '@/features/borrowers/components/borrower-form';
import {
  getBorrowerById,
  getCaseBorrowerLink,
} from '@/features/borrowers/services/borrowers.service';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { userCanEditCase } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

type Props = { params: Promise<{ id: string; borrowerId: string }> };

export default async function EditBorrowerPage({ params }: Props) {
  const { id, borrowerId } = await params;

  const caseId = asCaseId(id);
  const borrowerIdBranded = asBorrowerId(borrowerId);
  const [caseData, borrower, link] = await Promise.all([
    getRawCaseById(caseId),
    getBorrowerById(borrowerIdBranded),
    getCaseBorrowerLink(caseId, borrowerIdBranded),
  ]);

  if (!caseData || !borrower || !link) notFound();
  // View-only users (can see the case but not edit it) must not get the
  // editable borrower form — mirrors the case-detail page's can_edit_case gate.
  if (!(await userCanEditCase(caseId))) notFound();

  const t = await getTranslations('case');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());

  const fullName =
    formatPersonName(borrower.first_name, borrower.last_name) || tc('noName');

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
        <h1 className="text-2xl font-light text-neutral-900">
          {tc('edit')} · {t('borrower.borrower')} · {fullName}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        {/* key={borrower.id} = fresh form instance per borrower (clean
            uncontrolled DOM state when navigating between borrowers). */}
        <BorrowerForm
          key={borrower.id}
          caseId={id}
          initial={borrower}
          initialRole={link.role_in_case}
          initialIsPrimary={link.is_primary}
        />
      </div>
    </div>
  );
}
