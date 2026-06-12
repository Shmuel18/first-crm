'use client';

import { useState, type ReactElement } from 'react';

import { Download, Share, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePwaInstall } from '../hooks/use-pwa-install';

const DISMISS_KEY = 'kfg:pwa-banner-dismissed';

function initialDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Dismissible mobile-only "install this app" banner. Shows when the app is
 * installable (Chromium beforeinstallprompt) or on iOS Safari (manual
 * instructions), unless already installed or previously dismissed. Desktop is
 * served by the Settings entry instead, so this is hidden at md+.
 */
export function InstallBanner(): ReactElement | null {
  const t = useTranslations('pwa');
  const { canPrompt, promptInstall, isIOS, isStandalone, ready } = usePwaInstall();
  const [dismissed, setDismissed] = useState<boolean>(initialDismissed);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage may be unavailable (private mode) — dismiss for the session only */
    }
  };

  if (!ready || isStandalone || dismissed) return null;
  if (!canPrompt && !isIOS) return null;

  return (
    <div
      role="status"
      aria-label={t('install')}
      className="md:hidden fixed inset-x-2 z-40 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] rounded-xl border border-brand-gold/30 bg-brand-black text-white shadow-xl"
    >
      <div className="flex items-center gap-3 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static precached icon, not worth next/image */}
        <img src="/icons/icon-192.png" alt="" aria-hidden="true" className="size-9 shrink-0 rounded-lg" />
        <p className="flex-1 text-xs leading-snug text-neutral-200">
          {canPrompt ? t('bannerText') : t('iosInstructions')}
        </p>
        {canPrompt ? (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-black"
          >
            <Download className="size-3.5" aria-hidden="true" />
            {t('install')}
          </button>
        ) : (
          <Share className="size-5 shrink-0 text-brand-gold-light" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="-me-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
