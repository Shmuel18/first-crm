'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BankFormDialog } from './bank-form-dialog';
import { BankRow } from './bank-row';
import type { Bank } from '../services/banks.service';

type Props = { banks: ReadonlyArray<Bank> };

export function BanksManager({ banks }: Props) {
  const t = useTranslations('settings.banks');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (bank: Bank) => {
    setEditing(bank);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gold px-4 text-sm font-medium text-brand-black transition hover:bg-brand-gold-dark"
        >
          <Plus className="size-4" />
          {t('new')}
        </button>
      </div>

      {banks.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-neutral-500">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {banks.map((bank) => (
            <BankRow key={bank.id} bank={bank} onEdit={openEdit} />
          ))}
        </ul>
      )}

      <BankFormDialog
        key={editing?.id ?? 'new'}
        open={open}
        onOpenChange={setOpen}
        mode={editing ? 'edit' : 'create'}
        bank={editing}
      />
    </div>
  );
}
