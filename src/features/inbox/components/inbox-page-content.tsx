'use client';

import Link from 'next/link';

import { Inbox as InboxIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { InboxItem, InboxTab } from '../types';
import { InboxItemRow } from './inbox-item-row';

type Props = {
  items: InboxItem[];
  tab: InboxTab;
  attentionCount: number;
};

const TABS: readonly InboxTab[] = ['attention', 'all', 'handled'] as const;

/**
 * The triage queue (ai-v2-spec.md §3.5). Tabs are plain links (?tab=) so the
 * server re-fetches under RLS — no client cache to go stale. Rows handle
 * their own optimistic actions.
 */
export function InboxPageContent({ items, tab, attentionCount }: Props) {
  const t = useTranslations('inbox');

  return (
    <div className="space-y-4">
      <nav aria-label={t('tabsLabel')} className="flex items-center gap-1 border-b border-neutral-200">
        {TABS.map((key) => (
          <Link
            key={key}
            href={key === 'attention' ? '/inbox' : `/inbox?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-brand-gold-dark text-neutral-950'
                : 'border-transparent text-neutral-500 hover:text-neutral-800',
            )}
          >
            {t(`tabs.${key}`)}
            {key === 'attention' && attentionCount > 0 && (
              <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
                {attentionCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white py-14 text-center">
          <InboxIcon className="size-8 text-neutral-300" aria-hidden="true" />
          <p className="text-sm text-neutral-500">{t('empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <InboxItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
