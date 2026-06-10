'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ChevronRight } from 'lucide-react';

type Props = {
  href: string;
  label: string;
  /**
   * Pre-rendered icon element. Receiving an element (not a component) keeps
   * the RSC boundary clean — lucide-react 1.16+ wraps icons in forwardRef,
   * which React refuses to serialize as a function across the Server →
   * Client boundary. Rendering the icon on the server side gives us a
   * plain React element (a JSON-serializable object) that survives the trip.
   */
  icon: React.ReactNode;
};

/**
 * Settings sidebar nav link. Splits out the active-page logic so the
 * server-rendered SettingsLayout can stay synchronous and i18n-driven —
 * the client component only handles "is this the current page".
 */
export function SettingsNavLink({ href, label, icon }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  // py-3 on mobile lifts the row to a ~44px touch target (the drill-in menu
  // is the whole screen there); desktop keeps the original compact py-2.
  const className = [
    'flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-sm transition',
    active
      ? 'bg-brand-gold-soft text-brand-gold-text font-medium'
      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
  ].join(' ');

  return (
    <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
      {icon}
      <span className="flex-1">{label}</span>
      {/* Drill-in affordance, mobile only; "forward" flips with direction. */}
      <ChevronRight
        className="md:hidden size-4 text-neutral-400 rtl:rotate-180"
        aria-hidden="true"
      />
    </Link>
  );
}
