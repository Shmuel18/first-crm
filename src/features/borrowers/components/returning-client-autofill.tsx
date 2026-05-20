'use client';

import { useState, useTransition, type RefObject } from 'react';

import { Loader2, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  lookupReturningBorrowerAction,
  type ReturningBorrower,
} from '../actions/lookup-returning-borrower';

// Person-level fields safe to copy from a prior case onto a returning client.
const FILL_FIELDS = [
  'first_name',
  'last_name',
  'phone',
  'email',
  'birth_date',
  'marital_status',
  'children_count',
  'address',
  'citizenship',
  'residency_type',
  'employment_status',
  'employer_name',
] as const satisfies readonly (keyof ReturningBorrower)[];

type Status = 'idle' | 'none' | 'found';

export function ReturningClientAutofill({
  formRef,
}: {
  formRef: RefObject<HTMLFormElement | null>;
}) {
  const t = useTranslations('borrowerForm.returning');
  const tc = useTranslations('common');
  const [status, setStatus] = useState<Status>('idle');
  const [match, setMatch] = useState<ReturningBorrower | null>(null);
  const [isPending, startTransition] = useTransition();

  const field = (
    name: string,
  ): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null => {
    const el = formRef.current?.elements.namedItem(name);
    return el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
      ? el
      : null;
  };

  const check = () => {
    const id = field('national_id')?.value.trim() ?? '';
    if (!id) return;
    startTransition(async () => {
      const found = await lookupReturningBorrowerAction(id);
      setMatch(found);
      setStatus(found ? 'found' : 'none');
    });
  };

  const fill = () => {
    if (!match) return;
    for (const name of FILL_FIELDS) {
      const el = field(name);
      if (el) {
        const value = match[name];
        el.value = value == null ? '' : String(value);
      }
    }
    setStatus('idle');
    setMatch(null);
  };

  const matchName = match
    ? [match.first_name, match.last_name].filter(Boolean).join(' ').trim()
    : '';

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={check}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A88840] transition hover:text-[#0A0A0A] disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserCheck className="size-3.5" />
          )}
          {t('check')}
        </button>
        {status === 'found' && (
          <>
            <span className="text-xs text-neutral-600">
              {t('found', { name: matchName || tc('noName') })}
            </span>
            <button
              type="button"
              onClick={fill}
              className="inline-flex items-center gap-1 rounded-md bg-[#C9A961] px-2 py-1 text-xs font-semibold text-[#0A0A0A] transition hover:bg-[#E8D5A2]"
            >
              {t('fill')}
            </button>
          </>
        )}
        {status === 'none' && <span className="text-xs text-neutral-500">{t('none')}</span>}
      </div>
    </div>
  );
}
