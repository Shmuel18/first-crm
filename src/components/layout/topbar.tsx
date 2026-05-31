import Image from 'next/image';
import Link from 'next/link';

import { Plus } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { MobileNav } from '@/components/layout/mobile-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { parseLocale } from '@/lib/i18n/direction';
import { getLayoutBootstrap } from '@/lib/layout/bootstrap';
import { formatPersonName } from '@/lib/utils/person-name';

type TopbarProps = {
  tasksBadge?: number;
  criticalTasksBadge?: number;
};

export async function Topbar({ tasksBadge, criticalTasksBadge }: TopbarProps = {}) {
  const t = await getTranslations('topbar');
  const locale = parseLocale(await getLocale());

  // Reuses the cached bootstrap envelope from AppLayout — same RPC call,
  // no second round-trip even though both this component and the layout
  // independently call getLayoutBootstrap.
  const { profile, unreadNotifications, recentNotifications, canCreateCase } =
    await getLayoutBootstrap();

  const fullName =
    formatPersonName(profile?.first_name, profile?.last_name) ||
    profile?.email ||
    '';
  const initials = getInitials(profile?.first_name, profile?.last_name, profile?.email);
  const roleName = (locale === 'en' ? profile?.roleNameEn : profile?.roleNameHe) ?? '';

  return (
    <header className="h-16 bg-brand-black text-white sticky top-0 z-30 shadow-md">
      <div className="h-full px-4 flex items-center gap-3">
        <MobileNav tasksBadge={tasksBadge} criticalTasksBadge={criticalTasksBadge} />

        <Link href="/cases" className="shrink-0" aria-label="Kaufman Finance Group">
          <Image
            src="/logo-mark.png"
            alt="Kaufman Finance Group"
            width={1152}
            height={740}
            priority
            className="h-10 w-auto"
          />
        </Link>

        <div className="flex items-center gap-2 shrink-0 ms-auto">
          {canCreateCase && (
            <Link
              href="/cases/new"
              aria-label={t('newCase')}
              className="btn-gold inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">{t('newCase')}</span>
            </Link>
          )}

          <NotificationBell
            initialUnread={unreadNotifications}
            notifications={recentNotifications}
            locale={locale}
          />

          <UserMenu fullName={fullName} initials={initials} roleName={roleName} />
        </div>
      </div>
    </header>
  );
}

function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
): string {
  const first = firstName?.[0] ?? '';
  const last = lastName?.[0] ?? '';
  const combined = (first + last).trim();
  if (combined) return combined;
  return email?.[0]?.toUpperCase() ?? '?';
}
