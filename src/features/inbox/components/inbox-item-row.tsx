'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Check, ExternalLink, Link2, Loader2, Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

import { linkInboxItemToCaseAction } from '../actions/link-inbox-item';
import { resolveInboxItemAction } from '../actions/resolve-inbox-item';
import type { EmailCategory, InboxItem } from '../types';

/** Category → chip tone. Escalations amber, routine neutral, client gold. */
const CATEGORY_TONE: Record<EmailCategory, string> = {
  client_documents: 'bg-brand-gold-soft text-brand-gold-text',
  client_message: 'bg-brand-gold-soft text-brand-gold-text',
  probable_client: 'bg-amber-100 text-amber-800',
  bank: 'bg-blue-50 text-blue-800',
  vendor_or_marketing: 'bg-neutral-100 text-neutral-500',
  internal: 'bg-neutral-100 text-neutral-500',
  unclear: 'bg-amber-100 text-amber-800',
};

export function InboxItemRow({ item }: { item: InboxItem }) {
  const t = useTranslations('inbox');
  const tc = useTranslations('common');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const [caseNumber, setCaseNumber] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);

  if (gone) return null;

  const open = item.status === 'needs_review' || item.status === 'new';

  const resolve = async (verdict: 'acknowledged' | 'dismissed') => {
    if (busy) return;
    setBusy(true);
    const res = await resolveInboxItemAction(item.id, verdict);
    setBusy(false);
    if (!res.ok) {
      toast.error(tc('saveFailed'));
      return;
    }
    setGone(true); // optimistic — leaves the current tab
    router.refresh();
  };

  const link = async () => {
    if (busy || !caseNumber.trim()) return;
    setBusy(true);
    const res = await linkInboxItemToCaseAction(item.id, caseNumber);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error === 'case_not_found' ? t('caseNotFound') : tc('saveFailed'));
      return;
    }
    setGone(true);
    router.refresh();
  };

  return (
    <li className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', CATEGORY_TONE[item.category])}>
          {t(`categories.${item.category}`)}
        </span>
        <span className="text-sm font-semibold text-neutral-950 truncate max-w-[24ch]">
          {item.from_name ?? item.from_email}
        </span>
        <span className="text-sm text-neutral-600 truncate flex-1 min-w-[10ch]">
          {item.subject ?? t('noSubject')}
        </span>
        {item.attachments_count > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
            <Paperclip className="size-3" aria-hidden="true" />
            {item.attachments_count}
          </span>
        )}
        {item.received_at && (
          <time dateTime={item.received_at} className="text-[11px] text-neutral-400 tabular-nums">
            {new Date(item.received_at).toLocaleString('he-IL', {
              timeZone: 'Asia/Jerusalem',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        )}
      </div>

      {item.summary_he && <p className="mt-1 text-sm text-neutral-700">{item.summary_he}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.case && (
          <Link
            href={`/cases/${item.case.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text hover:underline"
          >
            <Link2 className="size-3" aria-hidden="true" />
            {t('caseLink', { number: String(item.case.case_number ?? '') })}
          </Link>
        )}
        <a
          href={`https://mail.google.com/mail/u/0/#all/${item.gmail_message_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          {t('openInGmail')}
        </a>

        {open && (
          <span className="ms-auto flex items-center gap-1.5">
            {!item.case && !linkOpen && (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                {t('linkToCase')}
              </button>
            )}
            {linkOpen && (
              <span className="flex items-center gap-1">
                <input
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void link()}
                  inputMode="numeric"
                  placeholder={t('caseNumberPlaceholder')}
                  aria-label={t('caseNumberPlaceholder')}
                  className="h-7 w-24 rounded-md border border-neutral-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
                <button
                  type="button"
                  onClick={() => void link()}
                  disabled={busy}
                  className="rounded-md bg-brand-black px-2 py-1 text-xs text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3 animate-spin" /> : t('linkConfirm')}
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => void resolve('acknowledged')}
              disabled={busy}
              aria-label={t('acknowledge')}
              title={t('acknowledge')}
              className="flex size-7 items-center justify-center rounded-md border border-neutral-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void resolve('dismissed')}
              disabled={busy}
              aria-label={t('dismiss')}
              title={t('dismiss')}
              className="flex size-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}
      </div>
    </li>
  );
}
