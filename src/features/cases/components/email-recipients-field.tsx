'use client';

import { Check, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { EmailRecipient } from '../domain/email-recipients';

type Props = {
  /** Everyone on the case with an address, primary first. */
  recipients: ReadonlyArray<EmailRecipient>;
  selectedIds: ReadonlyArray<string>;
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

/**
 * "To:" field for client emails — one toggle per borrower who has an address.
 *
 * A couple's contact details are often split (one has the email, the other the
 * phone), so the address is a choice rather than a derived value. Shown even
 * with a single recipient, so the advisor always sees who the mail goes to.
 */
export function EmailRecipientsField({ recipients, selectedIds, onChange, disabled }: Props) {
  const t = useTranslations('composeEmail.recipients');

  const toggle = (borrowerId: string): void => {
    const next = selectedIds.includes(borrowerId)
      ? selectedIds.filter((id) => id !== borrowerId)
      : [...selectedIds, borrowerId];
    onChange(next);
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-neutral-600">{t('label')}</span>
      <div className="flex flex-wrap gap-1.5">
        {recipients.map((r) => {
          const selected = selectedIds.includes(r.borrowerId);
          return (
            <button
              key={r.borrowerId}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => toggle(r.borrowerId)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                selected
                  ? 'border-brand-gold bg-brand-gold-soft text-brand-gold-text'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {selected ? (
                <Check className="size-3 shrink-0" aria-hidden="true" />
              ) : (
                <Mail className="size-3 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate font-medium">{r.name || r.email}</span>
              <span className="truncate text-[10px] text-neutral-500" dir="ltr">
                {r.email}
              </span>
            </button>
          );
        })}
      </div>
      {selectedIds.length === 0 && (
        <p className="mt-1 text-[11px] text-amber-700">{t('noneSelected')}</p>
      )}
    </div>
  );
}
