'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BarChart3, Calculator, CheckSquare, Clock, Coins, HandCoins, LayoutDashboard, Settings, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { isNavItemActive } from './is-nav-item-active';

type FinanceKey = 'statistics' | 'collections' | 'maaser';
type LabelKey = 'cases' | 'tasks' | 'simulators' | 'timeClock' | 'settings' | 'finance' | FinanceKey;

const TIME_CLOCK_ITEM = { href: '/time-clock', labelKey: 'timeClock', icon: Clock } as const;

type NavItem = {
  href: string;
  labelKey: LabelKey;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  criticalBadge?: number;
};

type FinanceItem = NavItem & {
  labelKey: FinanceKey;
  adminOnly?: boolean;
  /** Gated on view_collections (not the admin flag). */
  collectionsOnly?: boolean;
};

// Always-visible flat tabs (before + after the finance slot).
const LEADING_ITEMS: readonly NavItem[] = [
  { href: '/cases', labelKey: 'cases', icon: LayoutDashboard },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
  { href: '/simulators', labelKey: 'simulators', icon: Calculator },
] as const;

const TRAILING_ITEMS: readonly NavItem[] = [
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

// The three money pages. On a phone they'd push the manager to 7 tabs, so they
// collapse into ONE slot here: a single direct tab when the user can reach only
// one of them (e.g. a non-admin collections officer → just גבייה), or a "כספים"
// menu when they can reach two or more (the manager). The desktop rail keeps
// them as separate icons — it has the vertical room.
const FINANCE_ITEMS: readonly FinanceItem[] = [
  { href: '/statistics', labelKey: 'statistics', icon: BarChart3, adminOnly: true },
  { href: '/collections', labelKey: 'collections', icon: Coins, collectionsOnly: true },
  { href: '/maaser', labelKey: 'maaser', icon: HandCoins, adminOnly: true },
] as const;

type Props = {
  tasksBadge?: number;
  criticalTasksBadge?: number;
  isManager?: boolean;
  canViewCollections?: boolean;
  canUseTimeClock?: boolean;
};

/**
 * Fixed bottom tab bar for phones (`md:hidden`). Replaces the hamburger drawer:
 * with only a handful of destinations, a thumb-reachable bottom bar with an
 * always-on "you are here" beats a two-tap top-start menu for an advisor
 * working from a phone all day. The desktop icon rail (`hidden md:flex`) takes
 * over at md+.
 */
export function BottomNav({
  tasksBadge,
  criticalTasksBadge,
  isManager,
  canViewCollections,
  canUseTimeClock,
}: Props): React.ReactElement {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const finance = FINANCE_ITEMS.filter(
    (item) => (!item.adminOnly || isManager) && (!item.collectionsOnly || canViewCollections),
  );

  const leading = LEADING_ITEMS.map((item) =>
    item.labelKey === 'tasks'
      ? { ...item, badge: tasksBadge, criticalBadge: criticalTasksBadge }
      : item,
  );

  return (
    <nav
      aria-label={t('primary')}
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-neutral-900 bg-brand-black pb-[env(safe-area-inset-bottom)] text-white"
    >
      {leading.map((item) => (
        <TabLink key={item.href} item={item} pathname={pathname} t={t} />
      ))}

      {/* Finance slot: nothing for advisors, a direct tab for a single page,
          a menu when there are two or more. */}
      {finance.length === 1 && finance[0] && (
        <TabLink item={finance[0]} pathname={pathname} t={t} />
      )}
      {finance.length > 1 && <FinanceMenu items={finance} pathname={pathname} t={t} />}

      {canUseTimeClock && <TabLink item={TIME_CLOCK_ITEM} pathname={pathname} t={t} />}

      {TRAILING_ITEMS.map((item) => (
        <TabLink key={item.href} item={item} pathname={pathname} t={t} />
      ))}
    </nav>
  );
}

const TAB_CLASS = [
  'relative min-w-0 flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold',
].join(' ');

type TFn = ReturnType<typeof useTranslations<'nav'>>;

function TabLink({ item, pathname, t }: { item: NavItem; pathname: string; t: TFn }): React.ReactElement {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href);
  const badge = item.badge && item.badge > 0 ? item.badge : undefined;
  const critical = item.criticalBadge && item.criticalBadge > 0 ? item.criticalBadge : undefined;
  const label = t(item.labelKey);
  const accessibleName = badge ? `${label} — ${t('unreadTasks', { count: badge })}` : label;

  return (
    <Link
      href={item.href}
      aria-label={accessibleName}
      aria-current={active ? 'page' : undefined}
      className={`${TAB_CLASS} ${active ? 'text-brand-gold-light' : 'text-neutral-300 hover:text-white'}`}
    >
      {active && (
        <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-gold" />
      )}
      <span className="relative">
        <Icon className="size-5" aria-hidden="true" />
        {badge !== undefined && (
          <span
            aria-hidden="true"
            className={[
              'absolute -top-1.5 -end-2 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center',
              critical ? 'task-critical-dot bg-red-600 text-white' : 'bg-brand-gold text-brand-black',
            ].join(' ')}
          >
            {critical ?? badge}
          </span>
        )}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

function FinanceMenu({
  items,
  pathname,
  t,
}: {
  items: readonly FinanceItem[];
  pathname: string;
  t: TFn;
}): React.ReactElement {
  // The slot reads as active when any of its pages is the current route.
  const active = items.some((i) => isNavItemActive(pathname, i.href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('finance')}
        className={`${TAB_CLASS} ${active ? 'text-brand-gold-light' : 'text-neutral-300 hover:text-white'}`}
      >
        {active && (
          <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-gold" />
        )}
        <Wallet className="size-5" aria-hidden="true" />
        <span className="max-w-full truncate">{t('finance')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" sideOffset={8} className="z-50 min-w-44">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.href}
              render={<Link href={item.href} />}
              className="flex items-center gap-2"
            >
              <Icon className="size-4 text-brand-gold-text" aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
