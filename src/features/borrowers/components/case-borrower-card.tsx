import Link from 'next/link';

import { Pencil, UserCircle2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { BorrowerRow, RoleInCase } from '../types';

type Props = {
  caseId: string;
  borrower: BorrowerRow;
  roleInCase: RoleInCase;
  isPrimary: boolean;
};

export async function CaseBorrowerCard({ caseId, borrower, roleInCase, isPrimary }: Props) {
  const t = await getTranslations('case.borrower');
  const tc = await getTranslations('common');
  const tCommon = await getTranslations('common');

  const fullName =
    [borrower.first_name, borrower.last_name].filter(Boolean).join(' ') || tCommon('noName');
  const roleLabel = t(roleInCase);

  return (
    <div className="border border-neutral-200 rounded-lg p-4 hover:border-[#C9A961]/30 hover:bg-[#C9A961]/5 transition group">
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="size-9 rounded-full bg-neutral-100 flex items-center justify-center">
            <UserCircle2 className="size-5 text-neutral-500" />
          </span>
          <div className="flex flex-col">
            <span className="font-medium text-neutral-900 text-sm">{fullName}</span>
            <span className="text-xs text-neutral-500">
              {roleLabel}
              {isPrimary && ` · ${t('primarySuffix')}`}
            </span>
          </div>
        </div>
        <Link
          href={`/cases/${caseId}/borrowers/${borrower.id}/edit`}
          className="opacity-0 group-hover:opacity-100 transition size-7 rounded hover:bg-white flex items-center justify-center"
          title={tc('edit')}
        >
          <Pencil className="size-3 text-neutral-500" />
        </Link>
      </div>

      <div className="space-y-1.5 text-xs">
        {borrower.national_id && (
          <BorrowerField label={t('id')} value={borrower.national_id} mono />
        )}
        {borrower.phone && <BorrowerField label={t('phone')} value={borrower.phone} mono />}
        {borrower.email && <BorrowerField label={t('email')} value={borrower.email} />}
        {borrower.address && <BorrowerField label={t('address')} value={borrower.address} />}
      </div>
    </div>
  );
}

function BorrowerField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-neutral-500 min-w-12 shrink-0">{label}:</span>
      <span
        className={['text-neutral-800', mono ? 'font-mono' : ''].join(' ')}
        dir={mono ? 'ltr' : undefined}
      >
        {value}
      </span>
    </div>
  );
}
