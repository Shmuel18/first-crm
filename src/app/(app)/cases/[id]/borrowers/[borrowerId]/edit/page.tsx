import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { BorrowerForm } from '@/features/borrowers/components/borrower-form';
import {
  getBorrowerById,
  getCaseBorrowerLink,
} from '@/features/borrowers/services/borrowers.service';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

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

  const t = await getTranslations('case');
  const tc = await getTranslations('common');

  const fullName =
    [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') || tc('noName');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/cases/${id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <ArrowRight className="size-4" />
          {tc('back')}
        </Link>
        <h1 className="text-2xl font-light text-neutral-900">
          {tc('edit')} · {t('borrower.borrower')} · {fullName}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        {/* `key` forces a fresh mount when navigating between borrowers, so
            the form's `useState`-snapshotted defaults are recaptured for the
            new entity (rather than re-using the previous one's). */}
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
