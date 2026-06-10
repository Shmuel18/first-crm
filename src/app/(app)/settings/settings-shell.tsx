'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLocale, useTranslations } from 'next-intl';

import { BackArrow } from '@/components/shared/back-arrow';
import { parseLocale } from '@/lib/i18n/direction';

type Props = {
  /** Server-rendered settings nav (the <nav> with section headers + links). */
  nav: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Responsive drill-in shell for the settings area (UX review item #6).
 *
 * Desktop (md+): classic two-column master-detail — sidebar nav beside the
 * selected page, exactly as before.
 * Mobile: ONE level at a time. /settings shows only the menu; a category page
 * shows only its content plus a back link to the menu. Previously the
 * single-column grid stacked the full 13-item nav ABOVE the content, pushing
 * every actual setting below the fold.
 */
export function SettingsShell({ nav, children }: Props) {
  const t = useTranslations('settings.nav');
  const locale = parseLocale(useLocale());
  const pathname = usePathname();
  const isMenu = pathname === '/settings';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 mt-6">
      <aside className={isMenu ? undefined : 'hidden md:block'}>{nav}</aside>
      {/* div, not <main> — the (app) layout already owns the main landmark,
          and the old nested <main> here was an a11y violation. */}
      <div className={isMenu ? 'hidden md:block' : undefined}>
        {!isMenu && (
          <Link
            href="/settings"
            className="md:hidden mb-3 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-neutral-700 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
          >
            <BackArrow locale={locale} className="size-4" />
            {t('pageTitle')}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
