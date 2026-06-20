import Link from 'next/link';

import type { Locale } from '@/lib/i18n/direction';

import { BackArrow } from './back-arrow';

/**
 * The one canonical "back" affordance for the whole app: a quiet grey text link
 * with the direction-aware arrow + a label, placed at the start of the page
 * (right in RTL), above the title. Use this everywhere instead of hand-rolling a
 * back button — it keeps the position and design uniform across pages.
 */
export function BackLink({
  href,
  label,
  locale,
  className,
}: {
  href: string;
  label: string;
  locale: Locale;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900 ${className ?? ''}`}
    >
      <BackArrow locale={locale} className="size-4" />
      {label}
    </Link>
  );
}
