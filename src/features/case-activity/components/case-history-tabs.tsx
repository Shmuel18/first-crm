'use client';

import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import type { ReactNode } from 'react';

const VIEWS = ['activity', 'log'] as const;
type View = (typeof VIEWS)[number];

type Props = {
  /** Rendered when the active view is "activity" (the default). */
  activitySlot: ReactNode;
  /** Rendered when the active view is "log" (the raw audit table). */
  logSlot: ReactNode;
};

/**
 * Pill switcher backed by the URL's `?view=` param. Both panes are fetched
 * server-side in one pass (the feed derives from the same audit query the
 * table shows), so switching is shallow — instant, no server roundtrip.
 */
export function CaseHistoryTabs({ activitySlot, logSlot }: Props) {
  const t = useTranslations('caseActivity.tabs');
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum([...VIEWS]).withDefault('activity'),
  );

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={t('groupLabel')}
        className="inline-flex items-center rounded-lg bg-neutral-100 p-0.5"
      >
        <PillTab label={t('activity')} active={view === 'activity'} onClick={() => setView('activity')} />
        <PillTab label={t('log')} active={view === 'log'} onClick={() => setView('log')} />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {view === 'activity' ? activitySlot : logSlot}
      </div>
    </div>
  );
}

function PillTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50',
        active
          ? 'bg-brand-black text-white shadow-sm'
          : 'text-neutral-700 hover:text-brand-black hover:bg-white/70',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export type { View as CaseHistoryView };
