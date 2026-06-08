import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { IntakeHeader } from '@/features/intake/components/intake-header';
import { IntakeWizard } from '@/features/intake/components/intake-wizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('intake');
  return { title: t('title'), description: t('subtitle') };
}

/**
 * Public client-intake questionnaire. No auth — middleware does not gate /check
 * (it is absent from the protected list in src/lib/supabase/middleware.ts).
 */
export default function CheckPage() {
  return (
    // The document itself is locked (globals.css: html,body overflow-hidden).
    // Public pages opt back in by making their own root the scroll viewport.
    <main className="intake-scroll h-dvh overflow-y-auto bg-brand-gold-soft">
      <IntakeHeader />
      {/* nuqs reads the URL via useSearchParams → needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <IntakeWizard />
      </Suspense>
      <footer className="pb-10 text-center text-xs text-neutral-500">
        © Kaufman Finance Group
      </footer>
    </main>
  );
}
