import {
  Bell,
  Building2,
  Calculator,
  HardDrive,
  LayoutGrid,
  MessageSquare,
  Plug,
  ScrollText,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  Users,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { SettingsNavLink } from './settings-nav-link';

type SettingsNavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Granular permission gate; aligns the nav with the route's own check. */
  permission?: string;
  disabled?: boolean;
};

type SettingsNavSection = {
  /** Translation key under `settings.nav.sections`; rendered above the items. */
  titleKey: string;
  items: SettingsNavItem[];
};

/**
 * Sections group the 11-item nav into 3 visual chunks so the eye scans by
 * category instead of by line. Section headers don't add clicks and aren't
 * interactive — they're just labels above each group.
 */
const NAV_SECTIONS: SettingsNavSection[] = [
  {
    titleKey: 'personal',
    items: [
      { href: '/settings/profile', labelKey: 'profile', icon: UserCog },
      { href: '/settings/security', labelKey: 'security', icon: ShieldCheck },
      { href: '/settings/notifications', labelKey: 'notifications', icon: Bell },
      { href: '/settings/display', labelKey: 'display', icon: LayoutGrid },
    ],
  },
  {
    titleKey: 'office',
    items: [
      { href: '/settings/office', labelKey: 'office', icon: Building2, adminOnly: true },
      { href: '/settings/people', labelKey: 'people', icon: Users, adminOnly: true },
    ],
  },
  {
    titleKey: 'system',
    items: [
      { href: '/settings/templates', labelKey: 'templates', icon: MessageSquare, adminOnly: true },
      { href: '/settings/simulators', labelKey: 'simulators', icon: Calculator, permission: 'manage_simulator_settings' },
      { href: '/settings/integrations', labelKey: 'integrations', icon: Plug, adminOnly: true },
    ],
  },
  {
    titleKey: 'data',
    items: [
      { href: '/settings/import', labelKey: 'import', icon: Upload, adminOnly: true },
      { href: '/settings/audit-log', labelKey: 'auditLog', icon: ScrollText, adminOnly: true },
      { href: '/settings/recycle-bin', labelKey: 'recycleBin', icon: Trash2, adminOnly: true },
      { href: '/settings/backup', labelKey: 'backup', icon: HardDrive, adminOnly: true },
    ],
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
  const canManageSimulators = await userHasPermission('manage_simulator_settings');

  // Filter items per section, then drop sections that ended up empty (e.g.
  // a non-admin sees no items in the office/data sections — better to hide
  // the headers than to show a header above nothing). Items with a granular
  // `permission` are gated on that permission so the nav matches the route.
  const sections = NAV_SECTIONS.map((section) => ({
    titleKey: section.titleKey,
    items: section.items.filter((it) => {
      if (it.permission === 'manage_simulator_settings') return canManageSimulators;
      return !it.adminOnly || isAdmin === true;
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="-mt-6">
      <div className="bg-brand-gold-soft text-neutral-900 sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20">
        <h1 className="font-display text-base font-semibold">{t('pageTitle')}</h1>
        <p className="text-[11px] text-neutral-500 mt-0.5">{t('pageSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 mt-6">
        <aside>
          <nav aria-label={t('sectionsLandmark')} className="space-y-6">
          {sections.map((section) => (
            <div key={section.titleKey} className="space-y-1">
              {/* Plain gold section header — no pill background, just the
                  serif display font in brand-gold-text. Sections are
                  separated by the aside's space-y-6 (parent), so visual
                  grouping comes from spacing, not borders. */}
              <h2 className="font-display text-xs font-medium text-brand-gold-text px-3 pb-1.5">
                {t(`sections.${section.titleKey}`)}
              </h2>
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-300 cursor-not-allowed pointer-events-none"
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
                  );
                }
                return (
                  <SettingsNavLink
                    key={item.href}
                    href={item.href}
                    label={t(item.labelKey)}
                    icon={<Icon className="size-4" />}
                  />
                );
              })}
            </div>
          ))}
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
