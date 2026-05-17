import Link from 'next/link';

import { Mail, Phone, Pencil, Plus, Star } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

import { CaseStatusBadge } from '@/features/cases/components/case-status-badge';

import { listCaseBanks } from '../services/case-banks.service';

type Props = { caseId: string };

export async function CaseBanksSection({ caseId }: Props) {
  const banks = await listCaseBanks(caseId);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900">
          בנקים בתיק {banks.length > 0 && `(${banks.length})`}
        </h3>
        <Link
          href={`/cases/${caseId}/banks/new`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Plus className="size-3.5" />
          הוסף בנק
        </Link>
      </div>

      {banks.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-6">
          טרם נוספו בנקים לתיק
        </p>
      ) : (
        <ul className="space-y-3">
          {banks.map((cb) => (
            <li
              key={cb.id}
              className="flex items-start justify-between gap-4 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  {cb.bank?.color && (
                    <span
                      className="inline-block size-3 rounded-full shrink-0"
                      style={{ backgroundColor: cb.bank.color }}
                    />
                  )}
                  <span className="font-medium text-neutral-900">
                    {cb.bank?.name_he ?? '— ללא בנק —'}
                  </span>
                  {cb.is_primary && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-[#C9A961]"
                      title="בנק עיקרי"
                    >
                      <Star className="size-3.5 fill-current" />
                      עיקרי
                    </span>
                  )}
                  <CaseStatusBadge
                    name={cb.status?.name_he ?? null}
                    color={cb.status?.color ?? null}
                  />
                </div>

                {(cb.banker_name || cb.banker_phone || cb.banker_email) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                    {cb.banker_name && <span>{cb.banker_name}</span>}
                    {cb.banker_phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" />
                        <span dir="ltr">{cb.banker_phone}</span>
                      </span>
                    )}
                    {cb.banker_email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3" />
                        <span dir="ltr">{cb.banker_email}</span>
                      </span>
                    )}
                  </div>
                )}

                {cb.notes && (
                  <p className="text-xs text-neutral-500 line-clamp-2">{cb.notes}</p>
                )}
              </div>

              <Link
                href={`/cases/${caseId}/banks/${cb.id}/edit`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                title="ערוך"
              >
                <Pencil className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
