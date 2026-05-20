import Image from 'next/image';
import Link from 'next/link';

import { Plus } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import {
  countUnreadNotifications,
  listRecentNotifications,
} from '@/features/notifications/services/notifications.service';
import { getMyProfile } from '@/features/settings/services/settings.service';
import type { Locale } from '@/lib/i18n/direction';

export async function Topbar() {
  const t = await getTranslations('topbar');
  const locale = (await getLocale()) as Locale;

  const [profile, unread, notifications] = await Promise.all([
    getMyProfile(),
    countUnreadNotifications(),
    listRecentNotifications(),
  ]);

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    '';
  const initials = getInitials(profile?.first_name, profile?.last_name, profile?.email);
  const roleName = (locale === 'en' ? profile?.roleNameEn : profile?.roleNameHe) ?? '';

  return (
    <header className="h-16 bg-[#0A0A0A] text-white sticky top-0 z-30 shadow-md">
      <div className="h-full px-4 flex items-center gap-3">
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
          <Link
            href="/cases/new"
            className="btn-gold inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap"
          >
            <Plus className="size-4" />
            <span className="hidden md:inline">{t('newCase')}</span>
          </Link>

          <NotificationBell
            initialUnread={unread}
            notifications={notifications}
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
