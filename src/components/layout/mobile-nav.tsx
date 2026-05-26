'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { CheckSquare, LayoutDashboard, Menu, Settings, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type NavItem = {
  href: string;
  labelKey: 'dashboard' | 'tasks' | 'settings';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  adminOnly?: boolean;
};

// Mirrors Sidebar — Team / Templates / Audit Log moved into Settings tabs.
const BASE_TOP_ITEMS: readonly NavItem[] = [
  { href: '/cases', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare },
] as const;

const BOTTOM_ITEMS: readonly NavItem[] = [
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

type Props = {
  tasksBadge?: number;
};

/**
 * Hamburger + slide-in drawer that mirrors the desktop sidebar for screens
 * below the md breakpoint. The desktop sidebar is `hidden md:flex`, so
 * without this the entire app is unreachable from a phone (logo is the
 * only link). Always renders the trigger; the trigger is hidden on md+.
 */
export function MobileNav({ tasksBadge }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tc = useTranslations('common');

  // Closing on link tap is handled by passing close() to each MobileNavLink
  // — cleaner than the "useEffect on pathname change" pattern, which the
  // react-hooks/set-state-in-effect lint rule (rightly) flags as the kind
  // of cascading-render anti-pattern an effect shouldn't do.
  const close = () => setOpen(false);

  const topItems = BASE_TOP_ITEMS.map((i) =>
    i.labelKey === 'tasks' ? { ...i, badge: tasksBadge } : i,
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="md:hidden inline-flex items-center justify-center size-10 rounded-lg text-white hover:bg-neutral-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        aria-label={t('primary')}
      >
        <Menu className="size-5" aria-hidden="true" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-200" />
        <DialogPrimitive.Popup
          className={[
            'md:hidden fixed inset-y-0 start-0 z-50 w-[78%] max-w-[20rem]',
            'bg-brand-black text-white border-e border-neutral-900 shadow-2xl',
            'flex flex-col',
            // Slide from the start edge — rtl: from the right, ltr: from the
            // left. Tailwind v4's logical translate utilities don't ship a
            // cross-axis variant, so use explicit translate (RTL-safe via
            // the negative direction multiplier in CSS).
            'data-[starting-style]:opacity-0 data-[starting-style]:-translate-x-full rtl:data-[starting-style]:translate-x-full',
            'data-[ending-style]:opacity-0 data-[ending-style]:-translate-x-full rtl:data-[ending-style]:translate-x-full',
            'transition-all duration-200',
          ].join(' ')}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-900 shrink-0">
            <DialogPrimitive.Title className="font-display text-base text-white">
              {t('primary')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex items-center justify-center size-9 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              aria-label={tc('close')}
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <nav aria-label={t('primary')} className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
            {topItems.map((item) => (
              <MobileNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                label={t(item.labelKey)}
                onNavigate={close}
                badgeLabel={
                  item.badge && item.badge > 0
                    ? t('unreadTasks', { count: item.badge })
                    : undefined
                }
              />
            ))}
          </nav>

          <div className="px-2 py-3 border-t border-neutral-900 shrink-0">
            {BOTTOM_ITEMS.map((item) => (
              <MobileNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                label={t(item.labelKey)}
                onNavigate={close}
              />
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function MobileNavLink({
  item,
  pathname,
  label,
  onNavigate,
  badgeLabel,
}: {
  item: NavItem;
  pathname: string;
  label: string;
  onNavigate: () => void;
  badgeLabel?: string;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const badge = item.badge && item.badge > 0 ? item.badge : undefined;
  const accessibleName = badgeLabel ? `${label} — ${badgeLabel}` : label;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={accessibleName}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'flex items-center gap-3 px-3 py-3 rounded-lg text-base transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold',
        isActive
          ? 'bg-brand-gold/20 text-brand-gold-light'
          : 'text-neutral-200 hover:text-white hover:bg-neutral-900',
      ].join(' ')}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          aria-hidden="true"
          className="min-w-5 h-5 px-1.5 rounded-full bg-brand-gold text-brand-black text-xs font-bold inline-flex items-center justify-center"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
