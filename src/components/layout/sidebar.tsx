'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BarChart3, Calculator, CheckSquare, LayoutDashboard, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { isNavItemActive } from './is-nav-item-active';

type NavItem = {
  href: string;
  labelKey: 'cases' | 'tasks' | 'simulators' | 'statistics' | 'settings';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  criticalBadge?: number;
  adminOnly?: boolean;
};

// Team / Templates / Audit Log used to live here as top-level admin items.
// They moved into Settings (tabs) so the sidebar stays minimal and identical
// for admins and advisors. Pages still live at /team, /templates, /audit-log
// as redirects to /settings/<name> for back-compat with any old bookmarks.
const BASE_TOP_ITEMS: readonly NavItem[] = [
  { href: '/cases', labelKey: 'cases', icon: LayoutDashboard },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
  { href: '/simulators', labelKey: 'simulators', icon: Calculator },
  { href: '/statistics', labelKey: 'statistics', icon: BarChart3, adminOnly: true },
] as const;

const BOTTOM_ITEMS: readonly NavItem[] = [
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

type SidebarProps = {
  tasksBadge?: number;
  criticalTasksBadge?: number;
  isManager?: boolean;
};

export function Sidebar({ tasksBadge, criticalTasksBadge, isManager }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const topItems = BASE_TOP_ITEMS.filter((item) => !item.adminOnly || isManager).map((item) =>
    item.labelKey === 'tasks'
      ? { ...item, badge: tasksBadge, criticalBadge: criticalTasksBadge }
      : item,
  );

  return (
    <aside
      aria-label={t('sidebar')}
      // z-30 (same as the topbar — they sit on different rows so they never
      // overlap visually) so the icon-hover tooltips render above the sticky
      // case / documents action bars in the main scroll area (which use z-20).
      className="hidden md:flex flex-col w-16 bg-brand-black fixed start-0 top-16 bottom-0 z-30 border-e border-neutral-900 py-3"
    >
      <nav aria-label={t('primary')} className="flex-1 flex flex-col gap-1 px-2">
        {topItems.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
        ))}
      </nav>

      <div className="flex flex-col gap-1 px-2 pt-3 border-t border-neutral-900">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
        ))}
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  pathname,
  label,
}: {
  item: NavItem;
  pathname: string;
  label: string;
}) {
  const t = useTranslations('nav');
  const Icon = item.icon;
  const isActive = isNavItemActive(pathname, item.href);
  const badge = item.badge && item.badge > 0 ? item.badge : undefined;
  const criticalBadge =
    item.criticalBadge && item.criticalBadge > 0 ? item.criticalBadge : undefined;
  const accessibleName = badge ? `${label} — ${t('unreadTasks', { count: badge })}` : label;

  return (
    <Link
      href={item.href}
      aria-label={accessibleName}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'group relative h-12 rounded-lg flex items-center justify-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black',
        isActive
          ? 'bg-brand-gold/25 text-brand-gold-light'
          : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-900',
      ].join(' ')}
    >
      {/* Logical start-edge accent bar — clearly marks the active item on the
          dark rail (RTL-safe via start-0). */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute start-0 top-2 bottom-2 w-1 rounded-full bg-brand-gold"
        />
      )}

      <Icon className="size-5" aria-hidden="true" />

      {badge !== undefined && (
        <span
          aria-hidden="true"
          className={[
            'absolute top-1.5 end-1.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
            criticalBadge
              ? 'task-critical-dot bg-red-600 text-white'
              : 'bg-brand-gold text-brand-black',
          ].join(' ')}
        >
          {criticalBadge ?? badge}
        </span>
      )}

      <span
        aria-hidden="true"
        className="absolute start-full ms-2 px-2 py-1 bg-brand-black border border-brand-gold/40 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-visible:opacity-100 group-focus-visible:visible transition pointer-events-none z-50"
      >
        {label}
      </span>
    </Link>
  );
}
