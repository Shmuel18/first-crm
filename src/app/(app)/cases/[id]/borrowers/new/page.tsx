import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { BorrowerForm } from '@/features/borrowers/components/borrower-form';
import { getRawCaseById } from '@/features/cases/services/cases.service';

type Props = { params: Promise<{ id: string }> };

export default async function NewBorrowerPage({ params }: Props) {
  const { id } = await params;
  const caseData = await getRawCaseById(id);
  if (!caseData) notFound();

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
        <h1 className="text-2xl font-light text-neutral-900 font-mono">
          הוסף לווה לתיק {caseData.case_number}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          ניתן לשמור גם עם פרטים חלקיים
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <BorrowerForm caseId={id} />
      </div>
    </div>
  );
}
