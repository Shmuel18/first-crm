'use client';

import { UserCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatPersonName } from '@/lib/utils/person-name';

import { useReturningClientLookup } from '../hooks/use-returning-client-lookup';

import type { ReturningBorrowerMatch, ReturningProbe } from '../types';

type Props = {
  probe: ReturningProbe;
  /** Called when the user accepts a match. The parent owns how to apply it
   *  (write to the form DOM, or merge into draft state) and the overwrite flag. */
  onFill: (match: ReturningBorrowerMatch) => void;
};

/** Last 4 phone digits — disambiguates same-name people without showing the ID. */
function phoneSuffix(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

/**
 * Auto-detecting returning-client suggestion. Renders nothing until a lookup
 * (driven by `probe`) finds existing clients; then offers a one-click import
 * for a single hit, or a short pick-list when several match. Pure suggestion —
 * the parent only mutates fields when the user clicks.
 */
export function ReturningClientAutofill({ probe, onFill }: Props) {
  const t = useTranslations('borrowerForm.returning');
  const tc = useTranslations('common');
  const { matches, dismiss, accept } = useReturningClientLookup(probe);

  if (matches.length === 0) return null;

  const handlePick = (match: ReturningBorrowerMatch): void => {
    onFill(match);
    accept(match);
  };

  const single = matches.length === 1 ? matches[0] : null;
  const nameOf = (m: ReturningBorrowerMatch): string =>
    formatPersonName(m.first_name, m.last_name) || tc('noName');

  return (
    <div className="rounded-md border border-brand-gold/40 bg-brand-gold-soft px-3 py-2">
      <div className="flex items-start gap-2">
        <UserCheck aria-hidden="true" className="size-4 shrink-0 text-brand-gold-text mt-0.5" />
        <div className="min-w-0 flex-1">
          {single ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-700">{t('found', { name: nameOf(single) })}</span>
              <button
                type="button"
                onClick={() => handlePick(single)}
                className="inline-flex items-center gap-1 rounded-md bg-brand-gold px-2 py-1 text-xs font-semibold text-brand-black transition hover:bg-brand-gold-hover"
              >
                {t('import')}
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-neutral-700">{t('chooseTitle')}</span>
              <ul className="space-y-1">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(m)}
                      className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-start text-xs text-neutral-700 transition hover:border-brand-gold/60 hover:bg-brand-gold/10"
                    >
                      <span className="truncate font-medium">{nameOf(m)}</span>
                      {m.city ? <span className="truncate text-neutral-500">· {m.city}</span> : null}
                      {phoneSuffix(m.phone) ? (
                        <span className="ms-auto text-neutral-400" dir="ltr">
                          …{phoneSuffix(m.phone)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="shrink-0 text-neutral-400 transition hover:text-neutral-700"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
