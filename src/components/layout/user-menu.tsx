'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Globe, Loader2, LogOut, Settings } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { logoutAction } from '@/features/auth/actions/logout';
import { switchLocaleAction } from '@/features/auth/actions/switch-locale';
import { cleanupPwaSession } from '@/features/pwa/lib/cleanup-pwa-session';

import { parseLocale, type Locale } from '@/lib/i18n/direction';

type UserMenuProps = {
  fullName: string;
  initials: string;
  roleName: string;
};

export function UserMenu({ fullName, initials, roleName }: UserMenuProps) {
  const t = useTranslations('topbar.userMenu');
  const currentLocale = parseLocale(useLocale());
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loggingOut, startLogout] = useTransition();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Tear down device-side PWA state (badge + this device's push subscription)
  // BEFORE signing out, so a shared device doesn't keep broadcasting the
  // previous user's activity (R2-pwa-1). Best-effort — never blocks logout.
  const handleLogout = (): void => {
    startLogout(async () => {
      await cleanupPwaSession();
      await logoutAction();
    });
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    // Escape closes the menu; focus-restore is handled by the wasOpen effect
    // below. Don't close mid-switch — let the transition resolve first.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isPending]);

  // Keep the menu OPEN while the locale switch is in flight (showing a spinner
  // on the target option), then close once the transition resolves.
  const switchTo = (locale: Locale) => {
    if (locale === currentLocale || isPending) return;
    setPendingLocale(locale);
    startTransition(async () => {
      await switchLocaleAction(locale);
      setPendingLocale(null);
      setOpen(false);
    });
  };

  // Restore focus to the trigger only on the open→closed transition. Without
  // the `wasOpen` ref, this would `focus()` on initial mount too, which —
  // because programmatic focus also triggers :focus-visible — would draw a
  // gold ring around the avatar on every page refresh.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open && document.activeElement === document.body) {
      buttonRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('open')}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2.5 px-3 py-1.5 border border-brand-black-border rounded-lg hover:border-brand-gold hover:bg-brand-black-soft transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black"
      >
        <div
          aria-hidden="true"
          className="size-8 rounded-full btn-gold flex items-center justify-center font-bold text-xs"
        >
          {initials}
        </div>
        <div className="hidden md:flex flex-col leading-tight items-start">
          <span className="text-xs font-medium">{fullName}</span>
          <span className="text-[10px] text-neutral-300">{roleName}</span>
        </div>
      </button>

      {open && (
        // Disclosure popup (NOT an ARIA menu): its controls are native links/
        // buttons reachable by Tab. role="menu" would promise an arrow-key
        // model this doesn't implement (R2-shell-1).
        <div
          ref={menuRef}
          aria-label={t('open')}
          className="absolute end-0 top-full mt-2 w-64 bg-white text-neutral-900 rounded-lg shadow-2xl border border-neutral-200 z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <div className="text-sm font-medium text-neutral-900">{fullName}</div>
            <div className="text-xs text-neutral-600 mt-0.5">{roleName}</div>
          </div>

          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="inline-flex items-center gap-1.5 text-xs text-neutral-600 mb-2">
              <Globe className="size-3.5" aria-hidden="true" />
              {t('language')}
            </div>
            <div className="flex gap-1" role="group" aria-label={t('language')}>
              <LocaleOption
                label={t('languageHebrew')}
                active={currentLocale === 'he'}
                disabled={isPending}
                loading={pendingLocale === 'he'}
                onClick={() => switchTo('he')}
              />
              <LocaleOption
                label={t('languageEnglish')}
                active={currentLocale === 'en'}
                disabled={isPending}
                loading={pendingLocale === 'en'}
                onClick={() => switchTo('en')}
              />
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2.5 text-sm text-start hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-neutral-50 inline-flex items-center gap-2 text-neutral-700"
          >
            <Settings className="size-4 text-neutral-500" aria-hidden="true" />
            {t('settings')}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full px-4 py-2.5 text-sm text-start border-t border-neutral-100 hover:bg-red-50 focus-visible:outline-none focus-visible:bg-red-50 inline-flex items-center gap-2 text-red-700 disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}

function LocaleOption({
  label,
  active,
  disabled,
  loading,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-busy={loading || undefined}
      className={[
        'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-60',
        active
          ? 'bg-brand-gold text-black'
          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
      ].join(' ')}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        active && <Check className="size-3" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
