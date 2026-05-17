import Link from 'next/link';

import { Mail, Pencil, Phone, Plus, Star, User } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

import { listBorrowersForCase } from '../services/borrowers.service';

type Props = { caseId: string };

const ROLE_LABELS = {
  borrower: 'לווה',
  guarantor: 'ערב',
} as const;

export async function BorrowersSection({ caseId }: Props) {
  const items = await listBorrowersForCase(caseId);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900">
          לווים בתיק {items.length > 0 && `(${items.length})`}
        </h3>
        <Link
          href={`/cases/${caseId}/borrowers/new`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Plus className="size-3.5" />
          הוסף לווה
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-6">
          טרם נוספו לווים לתיק
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map(({ borrower, role_in_case, is_primary }) => {
            const fullName =
              [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') ||
              '(ללא שם)';

            return (
              <li
                key={borrower.id}
                className="flex items-start justify-between gap-4 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <div className="flex gap-3 flex-1">
                  <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                    <User className="size-5 text-neutral-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-neutral-900">{fullName}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                        {ROLE_LABELS[role_in_case]}
                      </span>
                      {is_primary && (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-[#C9A961]"
                          title="לווה ראשי"
                        >
                          <Star className="size-3.5 fill-current" />
                          ראשי
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                      {borrower.national_id && (
                        <span className="font-mono">ת"ז {borrower.national_id}</span>
                      )}
                      {borrower.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" />
                          <span dir="ltr">{borrower.phone}</span>
                        </span>
                      )}
                      {borrower.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" />
                          <span dir="ltr">{borrower.email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/cases/${caseId}/borrowers/${borrower.id}/edit`}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  title="ערוך"
                >
                  <Pencil className="size-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
