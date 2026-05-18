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
  { href: '/settings/profile', labelKey: 'profile', icon: UserCog, disabled: true },
  { href: '/settings/security', labelKey: 'security', icon: ShieldCheck, disabled: true },
  {
    href: '/settings/notifications',
    labelKey: 'notifications',
    icon: Bell,
    disabled: true,
  },
  {
    href: '/settings/office',
    labelKey: 'office',
    icon: Building2,
    adminOnly: true,
    disabled: true,
  },
  {
    href: '/settings/roles',
    labelKey: 'roles',
    icon: KeyRound,
    adminOnly: true,
    disabled: true,
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
    disabled: true,
  },
  {
    href: '/settings/backup',
    labelKey: 'backup',
    icon: HardDrive,
    adminOnly: true,
    disabled: true,
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
      <div className="bg-[#0A0A0A] text-white sticky top-16 z-20 shadow-lg -mx-6 px-6 py-4 border-b border-neutral-800">
        <h1 className="font-display text-xl font-medium">{t('pageTitle')}</h1>
        <p className="text-xs text-neutral-400 mt-1">{t('pageSubtitle')}</p>
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
