import Link from 'next/link';

import { Bell, LogOut, Plus, Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { LanguageToggle } from '@/components/layout/language-toggle';

import { logoutAction } from '@/features/auth/actions/logout';
import { createClient } from '@/lib/supabase/server';

export async function Topbar() {
  const t = await getTranslations('topbar');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await supabase
        .from('profiles')
        .select('first_name, last_name, email, roles(name_he)')
        .eq('id', user.id)
        .single()
        .then((r) => r.data)
    : null;

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    '';
  const initials = getInitials(profile?.first_name, profile?.last_name, profile?.email);
  const roleName = profile?.roles?.name_he ?? '';

  return (
    <header className="h-16 bg-[#0A0A0A] text-white sticky top-0 z-30 shadow-md">
      <div className="h-full px-4 flex items-center gap-4">
        <Link href="/cases" className="flex flex-col leading-tight shrink-0">
          <span className="brand-logo text-xl whitespace-nowrap">KAUFMAN</span>
          <span className="brand-tagline">FINANCE&nbsp;GROUP</span>
        </Link>

        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#C9A961] pointer-events-none" />
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pr-10 pl-4 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-[#C9A961] focus:bg-[#222] transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/cases/new"
            className="btn-gold inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap"
          >
            <Plus className="size-4" />
            <span className="hidden md:inline">{t('newCase')}</span>
          </Link>

          <button
            type="button"
            className="relative size-10 rounded-lg border border-[#333] hover:border-[#C9A961] hover:bg-[#1A1A1A] transition flex items-center justify-center"
            title={t('notifications')}
            aria-label={t('notifications')}
          >
            <Bell className="size-4" />
          </button>

          <LanguageToggle />

          <div className="flex items-center gap-2.5 px-3 py-1.5 border border-[#333] rounded-lg hover:border-[#C9A961] hover:bg-[#1A1A1A] transition cursor-pointer">
            <div className="size-8 rounded-full btn-gold flex items-center justify-center font-bold text-xs">
              {initials}
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-xs font-medium">{fullName}</span>
              <span className="text-[10px] text-neutral-500">{roleName}</span>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="size-10 rounded-lg border border-[#333] hover:border-red-500 hover:text-red-400 transition flex items-center justify-center"
              title={t('logout')}
              aria-label={t('logout')}
            >
              <LogOut className="size-4" />
            </button>
          </form>
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
