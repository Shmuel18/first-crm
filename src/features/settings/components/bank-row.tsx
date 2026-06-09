'use client';

import { useTransition } from 'react';

import Image from 'next/image';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { deleteBankAction } from '../actions/delete-bank';
import type { Bank } from '../services/banks.service';

type Props = { bank: Bank; onEdit: (bank: Bank) => void };

export function BankRow({ bank, onEdit }: Props) {
  const t = useTranslations('settings.banks');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(t('row.deleteConfirm', { name: bank.name_he }))) return;
    startTransition(async () => {
      const res = await deleteBankAction(bank.id);
      if (res.ok) toast.success(t('toast.deleted'));
      else if (res.error === 'in_use') toast.error(t('toast.inUse'));
      else if (res.error === 'system') toast.error(t('toast.system'));
      else toast.error(t('toast.failed'));
    });
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60">
      <span
        className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
        style={!bank.logo_url ? { backgroundColor: bank.color } : undefined}
      >
        {bank.logo_url ? (
          <Image
            src={bank.logo_url}
            alt=""
            fill
            sizes="36px"
            className="object-contain p-0.5"
            unoptimized={bank.logo_url.endsWith('.svg')}
          />
        ) : (
          <span className="text-[11px] font-bold text-white">{bank.name_he.slice(0, 2)}</span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{bank.name_he}</p>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">
            {t(`lenderTypes.${bank.lender_type}`)}
          </span>
          {!bank.is_active && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
              {t('row.inactive')}
            </span>
          )}
          {bank.is_system && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
              {t('row.system')}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-neutral-500">{bank.name_en}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(bank)}
          aria-label={`${tc('edit')} — ${bank.name_he}`}
          className="flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-brand-gold-text"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        {!bank.is_system && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            aria-label={`${tc('delete')} — ${bank.name_he}`}
            className="flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
