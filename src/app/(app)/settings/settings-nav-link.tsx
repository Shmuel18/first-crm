'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * Settings sidebar nav link. Splits out the active-page logic so the
 * server-rendered SettingsLayout can stay synchronous and i18n-driven —
 * the client component only handles "is this the current page".
 */
export function SettingsNavLink({ href, label, icon: Icon }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  const className = [
    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
    active
      ? 'bg-brand-gold-soft text-brand-gold-text font-medium'
      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
  ].join(' ');

  return (
    <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  );
}
