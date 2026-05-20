import Image from 'next/image';
import Link from 'next/link';

import { Plus, Search } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import {
  countUnreadNotifications,
  listRecentNotifications,
} from '@/features/notifications/services/notifications.service';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';

export async function Topbar() {
  const t = await getTranslations('topbar');
  const locale = (await getLocale()) as Locale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile, unread, notifications] = await Promise.all([
    user
      ? supabase
          .from('profiles')
          .select('first_name, last_name, email, roles(name_he)')
          .eq('id', user.id)
          .single()
          .then((r) => r.data)
      : Promise.resolve(null),
    countUnreadNotifications(),
    listRecentNotifications(),
  ]);

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    '';
  const initials = getInitials(profile?.first_name, profile?.last_name, profile?.email);
  const roleName = profile?.roles?.name_he ?? '';

  return (
    <header className="h-16 bg-[#0A0A0A] text-white sticky top-0 z-30 shadow-md">
      <div className="h-full px-4 flex items-center gap-3">
        <Link href="/cases" className="relative block h-10 w-32 shrink-0" aria-label="Kaufman Finance Group">
          <Image
            src="/logo.png"
            alt="Kaufman Finance Group"
            fill
            priority
            sizes="128px"
            className="object-contain object-start"
          />
        </Link>

        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[#C9A961] pointer-events-none" />
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg ps-4 pe-10 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-[#C9A961] focus:bg-[#222] transition"
          />
        </div>

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
