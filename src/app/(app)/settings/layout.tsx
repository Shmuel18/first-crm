import Link from 'next/link';

import {
  Bell,
  Building2,
  HardDrive,
  KeyRound,
  Plug,
  ShieldCheck,
  Upload,
  UserCog,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { createClient } from '@/lib/supabase/server';

type SettingsNavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  disabled?: boolean;
};

const NAV: SettingsNavItem[] = [
  { href: '/settings/profile', labelKey: 'profile', icon: UserCog },
  { href: '/settings/security', labelKey: 'security', icon: ShieldCheck },
  {
    href: '/settings/notifications',
    labelKey: 'notifications',
    icon: Bell,
  },
  {
    href: '/settings/office',
    labelKey: 'office',
    icon: Building2,
    adminOnly: true,
  },
  {
    href: '/settings/roles',
    labelKey: 'roles',
    icon: KeyRound,
    adminOnly: true,
  },
  {
    href: '/settings/integrations',
    labelKey: 'integrations',
    icon: Plug,
    adminOnly: true,
  },
  {
    href: '/settings/import',
    labelKey: 'import',
    icon: Upload,
    adminOnly: true,
  },
  {
    href: '/settings/backup',
    labelKey: 'backup',
    icon: HardDrive,
    adminOnly: true,
  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('settings.nav');

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  const items = NAV.filter((it) => !it.adminOnly || isAdmin === true);

  return (
    <div className="-mt-6">
      <div className="bg-[#FAF8F3] text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-[#C9A961]/20">
        <h1 className="font-display text-base font-semibold">{t('pageTitle')}</h1>
        <p className="text-[11px] text-neutral-500 mt-0.5">{t('pageSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 mt-6">
        <aside className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const className = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
              item.disabled
                ? 'text-neutral-300 cursor-not-allowed pointer-events-none'
                : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
            }`;
            return item.disabled ? (
              <div
                key={item.href}
                className={className}
                title={t('comingSoon')}
                role="link"
                aria-disabled="true"
              >
                <Icon className="size-4" />
                <span className="flex-1">{t(item.labelKey)}</span>
                <span className="text-[10px] uppercase text-neutral-400">
                  {t('comingSoon')}
                </span>
              </div>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                <Icon className="size-4" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
