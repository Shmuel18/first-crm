'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  CheckSquare,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type NavItem = {
  href: string;
  labelKey: 'dashboard' | 'tasks' | 'team' | 'templates' | 'auditLog' | 'settings';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const BASE_TOP_ITEMS: readonly NavItem[] = [
  { href: '/cases', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
  { href: '/team', labelKey: 'team', icon: Users },
  { href: '/templates', labelKey: 'templates', icon: MessageSquare },
  { href: '/audit-log', labelKey: 'auditLog', icon: ScrollText },
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
    <aside className="hidden md:flex flex-col w-16 bg-[#0A0A0A] fixed start-0 top-16 bottom-0 z-20 border-l border-neutral-900 py-3">
      <nav className="flex-1 flex flex-col gap-1 px-2">
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
  const Icon = item.icon;
  const isActive = pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      title={label}
      className={[
        'group relative h-12 rounded-lg flex items-center justify-center transition-colors',
        isActive
          ? 'bg-[#C9A961]/15 text-[#C9A961]'
          : 'text-neutral-500 hover:text-neutral-100 hover:bg-neutral-900',
      ].join(' ')}
    >
      <Icon className="size-5" />

      {item.badge !== undefined && item.badge > 0 && (
        <span className="absolute top-1.5 end-1.5 min-w-4 h-4 px-1 rounded-full bg-[#C9A961] text-[#0A0A0A] text-[10px] font-bold flex items-center justify-center">
          {item.badge}
        </span>
      )}

      <span className="absolute start-full ms-2 px-2 py-1 bg-[#0A0A0A] border border-[#C9A961]/40 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition pointer-events-none z-50">
        {label}
      </span>
    </Link>
  );
}
