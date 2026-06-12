'use client';

import type { ReactElement } from 'react';

import { CheckCircle2, Download, Share } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePwaInstall } from '../hooks/use-pwa-install';

/**
 * Settings entry to install the app on the current device. Chromium shows an
 * "Install" button (native prompt); iOS / browsers without a prompt show manual
 * Share → Add-to-Home-Screen instructions; an already-installed device shows a
 * confirmation. Rendered inside the Display settings page.
 */
export function InstallAppControl(): ReactElement {
  const t = useTranslations('pwa');
  const { canPrompt, promptInstall, isStandalone, ready } = usePwaInstall();

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icons/icon-192.png" alt="" aria-hidden="true" className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{t('settingsTitle')}</h3>
          <p className="mt-0.5 text-sm text-neutral-500">{t('settingsDesc')}</p>

          <div className="mt-3">
            {!ready ? null : isStandalone ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t('installed')}
              </span>
            ) : canPrompt ? (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-black transition hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('install')}
              </button>
            ) : (
              <p className="inline-flex items-start gap-2 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-neutral-700">
                <Share className="mt-0.5 size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
                {t('iosInstructions')}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
