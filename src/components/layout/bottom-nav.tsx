'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BarChart3, Calculator, CheckSquare, HandCoins, LayoutDashboard, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { isNavItemActive } from './is-nav-item-active';

type NavItem = {
  href: string;
  labelKey: 'cases' | 'tasks' | 'simulators' | 'statistics' | 'maaser' | 'settings';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  criticalBadge?: number;
  adminOnly?: boolean;
};

// Flat destinations for the bottom tab bar — four for advisors, six for the
// manager (the manager-only Statistics and Maaser tabs). Still few enough that a
// thumb-reachable tab bar beats a hamburger drawer.
const ITEMS: readonly NavItem[] = [
  { href: '/cases', labelKey: 'cases', icon: LayoutDashboard },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
  { href: '/simulators', labelKey: 'simulators', icon: Calculator },
  { href: '/statistics', labelKey: 'statistics', icon: BarChart3, adminOnly: true },
  { href: '/maaser', labelKey: 'maaser', icon: HandCoins, adminOnly: true },
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

type Props = {
  tasksBadge?: number;
  criticalTasksBadge?: number;
  isManager?: boolean;
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
}: Props): React.ReactElement {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const items = ITEMS.filter((item) => !item.adminOnly || isManager).map((item) =>
    item.labelKey === 'tasks'
      ? { ...item, badge: tasksBadge, criticalBadge: criticalTasksBadge }
      : item,
  );

  return (
    <nav
      aria-label={t('primary')}
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-neutral-900 bg-brand-black pb-[env(safe-area-inset-bottom)] text-white"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavItemActive(pathname, item.href);
        const badge = item.badge && item.badge > 0 ? item.badge : undefined;
        const critical =
          item.criticalBadge && item.criticalBadge > 0 ? item.criticalBadge : undefined;
        const label = t(item.labelKey);
        const accessibleName = badge ? `${label} — ${t('unreadTasks', { count: badge })}` : label;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={accessibleName}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative min-w-0 flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
              isManager ? 'text-[10px] tracking-tighter' : 'text-[11px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold',
              active ? 'text-brand-gold-light' : 'text-neutral-300 hover:text-white',
            ].join(' ')}
          >
            {/* Top accent marks the active tab (logical inset, RTL-safe). */}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-gold"
              />
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
      })}
    </nav>
  );
}
