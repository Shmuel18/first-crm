import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { BorrowerForm } from '@/features/borrowers/components/borrower-form';
import {
  getBorrowerById,
  getCaseBorrowerLink,
} from '@/features/borrowers/services/borrowers.service';
import { getRawCaseById } from '@/features/cases/services/cases.service';

type Props = { params: Promise<{ id: string; borrowerId: string }> };

export default async function EditBorrowerPage({ params }: Props) {
  const { id, borrowerId } = await params;

  const [caseData, borrower, link] = await Promise.all([
    getRawCaseById(id),
    getBorrowerById(borrowerId),
    getCaseBorrowerLink(id, borrowerId),
  ]);

  if (!caseData || !borrower || !link) notFound();

  const fullName =
    [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') || '(ללא שם)';

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      <div>
        <Link
          href={`/cases/${id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <ArrowRight className="size-4" />
          חזרה לתיק
        </Link>
        <h1 className="text-2xl font-light text-neutral-900">עריכת לווה - {fullName}</h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <BorrowerForm
          caseId={id}
          initial={borrower}
          initialRole={link.role_in_case}
          initialIsPrimary={link.is_primary}
        />
      </div>
    </div>
  );
}
