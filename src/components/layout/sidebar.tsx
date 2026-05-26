'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CheckSquare, LayoutDashboard, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

type NavItem = {
  href: string;
  labelKey: 'dashboard' | 'tasks' | 'settings';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  adminOnly?: boolean;
};

// Team / Templates / Audit Log used to live here as top-level admin items.
// They moved into Settings (tabs) so the sidebar stays minimal and identical
// for admins and advisors. Pages still live at /team, /templates, /audit-log
// as redirects to /settings/<name> for back-compat with any old bookmarks.
const BASE_TOP_ITEMS: readonly NavItem[] = [
  { href: '/cases', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
] as const;

const BOTTOM_ITEMS: readonly NavItem[] = [
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

type SidebarProps = {
  tasksBadge?: number;
};

export function Sidebar({ tasksBadge }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const topItems = BASE_TOP_ITEMS.map((item) =>
    item.labelKey === 'tasks' ? { ...item, badge: tasksBadge } : item,
  );

  return (
    <aside
      aria-label={t('primary')}
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
  const isActive = pathname.startsWith(item.href);
  const badge = item.badge && item.badge > 0 ? item.badge : undefined;
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
          ? 'bg-brand-gold/20 text-brand-gold-light'
          : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-900',
      ].join(' ')}
    >
      <Icon className="size-5" aria-hidden="true" />

      {badge !== undefined && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 end-1.5 min-w-4 h-4 px-1 rounded-full bg-brand-gold text-brand-black text-[10px] font-bold flex items-center justify-center"
        >
          {badge}
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
