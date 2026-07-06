'use client';

import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import type { ReactNode } from 'react';

const TABS = ['members', 'roles', 'perms'] as const;
type Tab = (typeof TABS)[number];

type Props = {
  /** Default tab when no ?tab= query is present. */
  initialTab?: Tab;
  /** Rendered when the active tab is "members". */
  membersSlot: ReactNode;
  /** Rendered when the active tab is "roles". */
  rolesSlot: ReactNode;
  /** Rendered when the active tab is "perms" (per-user permissions). */
  permsSlot: ReactNode;
};

/**
 * Pill switcher backed by the URL's `?tab=` param (nuqs, shallow=false so
 * back/forward and external links land on the right pane). Only the
 * currently-active section is mounted — switching tabs unmounts the other
 * so its local state (selected role, expanded categories, etc.) resets on
 * re-entry, which is the behaviour each section was already built for.
 */
export function PeopleTabsShell({ initialTab = 'members', membersSlot, rolesSlot, permsSlot }: Props) {
  const t = useTranslations('settings.people.tabs');
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum([...TABS]).withDefault(initialTab).withOptions({ shallow: false }),
  );

  return (
    <div className="space-y-6">
      <div
        role="group"
        aria-label={t('groupLabel')}
        className="inline-flex items-center bg-neutral-100 rounded-lg p-0.5"
      >
        <PillTab label={t('members')} active={tab === 'members'} onClick={() => setTab('members')} />
        <PillTab label={t('roles')} active={tab === 'roles'} onClick={() => setTab('roles')} />
        <PillTab label={t('perms')} active={tab === 'perms'} onClick={() => setTab('perms')} />
      </div>

      {tab === 'members' ? membersSlot : tab === 'roles' ? rolesSlot : permsSlot}
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
