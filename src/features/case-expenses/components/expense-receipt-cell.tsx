'use client';

import { useRef, useState, useTransition } from 'react';

import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';

import { getExpenseReceiptUrlAction } from '../actions/get-expense-receipt-url';
import { removeExpenseReceiptAction } from '../actions/remove-expense-receipt';
import { uploadExpenseReceiptAction } from '../actions/upload-expense-receipt';
import { RECEIPT_ALLOWED_MIME_TYPES } from '../schemas/receipt.schema';

type Props = {
  caseId: string;
  expenseId: string;
  canEdit: boolean;
  initialName: string | null;
};

const ACCEPT = RECEIPT_ALLOWED_MIME_TYPES.join(',');

/**
 * Invoice attachment control for one expense row (feature #8). Optimistic:
 * upload / remove flip local state immediately and the action runs without a
 * page revalidate — the heavy case page must not re-render for a row tweak.
 * View is shown to anyone who can see the row; upload/replace/remove only with
 * edit rights.
 */
export function ExpenseReceiptCell({ caseId, expenseId, canEdit, initialName }: Props) {
  const t = useTranslations('expenses.receipt');
  const tc = useTranslations('common');
  const [name, setName] = useState<string | null>(initialName);
  const [isBusy, startBusy] = useTransition();
  const [opening, setOpening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the user re-pick the same file
    if (!file) return;
    const fd = new FormData();
    fd.set('caseId', caseId);
    fd.set('expenseId', expenseId);
    fd.set('file', file);
    startBusy(async () => {
      const res = await uploadExpenseReceiptAction(fd);
      if (res.ok) {
        setName(res.receiptName);
        toast.success(t('uploaded'));
        return;
      }
      toast.error(
        res.error === 'rate_limited'
          ? t('errors.rateLimited')
          : res.message === 'fileTooLarge'
            ? t('errors.tooLarge')
            : res.message === 'fileTypeNotAllowed'
              ? t('errors.type')
              : t('errors.generic'),
      );
    });
  };

  const onView = () => {
    setOpening(true);
    void getExpenseReceiptUrlAction(expenseId, caseId)
      .then((res) => {
        if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer');
        else toast.error(tc('saveFailed'));
      })
      .finally(() => setOpening(false));
  };

  const onRemove = () => {
    startBusy(async () => {
      const res = await removeExpenseReceiptAction(expenseId, caseId);
      if (res.ok) {
        setName(null);
        toast.success(t('removed'));
      } else {
        toast.error(tc('saveFailed'));
      }
    });
  };

  const pick = () => inputRef.current?.click();
  const fileInput = (
    <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
  );

  if (name === null) {
    if (!canEdit) return null;
    return (
      <>
        {fileInput}
        <IconButton
          label={t('upload')}
          onClick={pick}
          disabled={isBusy}
          busy={isBusy}
          icon={<Paperclip className="size-3.5" aria-hidden="true" />}
        />
      </>
    );
  }

  return (
    <span className="inline-flex items-center">
      {fileInput}
      <IconButton
        label={t('view')}
        onClick={onView}
        disabled={opening}
        busy={opening}
        accent
        icon={<FileText className="size-3.5" aria-hidden="true" />}
      />
      {canEdit && (
        <IconButton
          label={t('replace')}
          onClick={pick}
          disabled={isBusy}
          busy={isBusy}
          icon={<Paperclip className="size-3" aria-hidden="true" />}
        />
      )}
      {canEdit && (
        <IconButton
          label={t('remove')}
          onClick={onRemove}
          disabled={isBusy}
          danger
          icon={<X className="size-3" aria-hidden="true" />}
        />
      )}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  busy,
  icon,
  accent,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
  icon: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  const tone = accent
    ? 'text-brand-gold-text hover:bg-brand-gold-soft'
    : danger
      ? 'text-neutral-400 hover:text-red-600'
      : 'text-neutral-400 hover:text-brand-gold-text';
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`size-7 rounded inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-50 ${tone}`}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : icon}
      </button>
    </Tooltip>
  );
}
