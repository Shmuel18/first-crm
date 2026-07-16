import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { IntakeHeader } from '@/features/intake/components/intake-header';
import { IntakeWizard } from '@/features/intake/components/intake-wizard';
import { ACCESSIBILITY_URL, PRIVACY_POLICY_URL } from '@/features/intake/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('intake');
  return { title: t('title'), description: t('subtitle') };
}

/**
 * Public client-intake questionnaire. No auth — middleware does not gate /check
 * (it is absent from the protected list in src/lib/supabase/middleware.ts).
 */
export default async function CheckPage() {
  const t = await getTranslations('intake');
  return (
    // The document itself is locked (globals.css: html,body overflow-hidden).
    // Public pages opt back in by making their own root the scroll viewport.
    <main className="intake-scroll h-dvh overflow-y-auto bg-brand-gold-soft">
      <IntakeHeader />
      {/* nuqs reads the URL via useSearchParams → needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <IntakeWizard />
      </Suspense>
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-10 text-center text-xs text-neutral-500">
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 transition hover:text-brand-gold-text"
        >
          {t('footer.privacy')}
        </a>
        <span aria-hidden="true" className="text-neutral-300">
          ·
        </span>
        <a
          href={ACCESSIBILITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 transition hover:text-brand-gold-text"
        >
          {t('footer.accessibility')}
        </a>
        <span aria-hidden="true" className="text-neutral-300">
          ·
        </span>
        <span>© Kaufman Finance Group</span>
      </footer>
    </main>
  );
}
