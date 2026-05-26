'use client';

import Link from 'next/link';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BackArrow } from '@/components/shared/back-arrow';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

import type { Locale } from '@/lib/i18n/direction';

/**
 * Mirrors CaseActionBar's chrome for the /cases/new draft page — same gold-soft
 * sticky banner, same back-arrow + label + status pill layout. The right-side
 * action cluster is replaced with a single "save" button (the only action
 * available before the case exists).
 *
 * The "ליד" status pill is read-only: the case defaults to lead status on
 * save (server-side in the RPC), so previewing it here keeps the visual
 * contract with the real action bar without offering a real status edit
 * (there's no case_id to write against yet).
 */

type Props = {
  locale: Locale;
  borrowerNamesPreview: string;
  canSave: boolean;
  pending: boolean;
  onSave: () => void;
};

export function DraftActionBar({
  locale,
  borrowerNamesPreview,
  canSave,
  pending,
  onSave,
}: Props) {
  const tc = useTranslations('common');
  const tDraft = useTranslations('case.draft');

  return (
    <div className="bg-brand-gold-soft text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Tooltip content={tc('back')}>
            <Link
              href="/cases"
              aria-label={tc('back')}
              className="inline-flex items-center justify-center size-7 border border-neutral-300 hover:border-brand-gold-text text-neutral-700 hover:text-brand-gold-text bg-white/60 rounded-md transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
            >
              <BackArrow locale={locale} className="size-3.5" aria-hidden="true" />
            </Link>
          </Tooltip>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display text-base font-semibold truncate max-w-md">
              {borrowerNamesPreview || tDraft('actionBar.title')}
            </span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span className="text-neutral-500 text-xs">{tDraft('actionBar.unsaved')}</span>
            {/* Read-only "ליד" pill — the RPC pins status to lead on save.
                Using a static neutral palette here since we don't have the
                real case_statuses.color value at render time (no DB lookup
                in a client component). */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: '#5B9BD525', color: '#3F7BB0' }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: '#5B9BD5' }}
                aria-hidden="true"
              />
              {tDraft('actionBar.leadStatus')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="bg-brand-black hover:bg-neutral-800 text-white h-9 min-w-28"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              tDraft('save.button')
            )}
          </Button>
        </div>
      </div>

      {!canSave && !pending && (
        <p className="mt-1.5 text-[11px] text-neutral-600">
          {tDraft('save.needBorrower')}
        </p>
      )}
    </div>
  );
}
