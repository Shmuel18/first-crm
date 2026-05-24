'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Globe, LogOut, Settings } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { logoutAction } from '@/features/auth/actions/logout';
import { switchLocaleAction } from '@/features/auth/actions/switch-locale';

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
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const switchTo = (locale: Locale) => {
    if (locale === currentLocale || isPending) return;
    startTransition(() => switchLocaleAction(locale));
    setOpen(false);
  };

  // Restore focus to the trigger when the menu closes — without this, mouse
  // users land back where they were but keyboard users get focus reset to <body>.
  useEffect(() => {
    if (!open && document.activeElement === document.body) {
      buttonRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('open')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 px-3 py-1.5 border border-[#333] rounded-lg hover:border-[#C9A961] hover:bg-[#1A1A1A] transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C77B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
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
        <div
          ref={menuRef}
          role="menu"
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
                onClick={() => switchTo('he')}
              />
              <LocaleOption
                label={t('languageEnglish')}
                active={currentLocale === 'en'}
                onClick={() => switchTo('en')}
              />
            </div>
          </div>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2.5 text-sm text-start hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-neutral-50 inline-flex items-center gap-2 text-neutral-700"
          >
            <Settings className="size-4 text-neutral-500" aria-hidden="true" />
            {t('settings')}
          </Link>

          <form action={logoutAction} className="border-t border-neutral-100">
            <button
              type="submit"
              role="menuitem"
              className="w-full px-4 py-2.5 text-sm text-start hover:bg-red-50 focus-visible:outline-none focus-visible:bg-red-50 inline-flex items-center gap-2 text-red-700"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t('logout')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function LocaleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40',
        active
          ? 'bg-[#C9A961] text-black'
          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
      ].join(' ')}
    >
      {active && <Check className="size-3" aria-hidden="true" />}
      {label}
    </button>
  );
}
