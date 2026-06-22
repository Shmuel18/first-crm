'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { BadgeCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { celebrateDocumentationMilestone } from './celebrate-documentation';

type Props = {
  celebrationId: number;
  milestone: boolean;
  onComplete: () => void;
};

export function DocumentationCelebration({
  celebrationId,
  milestone,
  onComplete,
}: Props): React.ReactPortal | null {
  const t = useTranslations('caseComments.celebration');

  useEffect(() => {
    if (milestone) celebrateDocumentationMilestone();
    const timer = window.setTimeout(onComplete, milestone ? 2_200 : 1_650);
    return () => window.clearTimeout(timer);
  }, [celebrationId, milestone, onComplete]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-milestone={milestone || undefined}
      className="documentation-celebration pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center px-4"
    >
      <div className="relative flex flex-col items-center">
        <div
          aria-hidden="true"
          className="documentation-celebration-glow bg-brand-gold/25 absolute inset-0 -z-10 rounded-full blur-3xl"
        />
        <span aria-hidden="true" className="documentation-spark documentation-spark-one" />
        <span aria-hidden="true" className="documentation-spark documentation-spark-two" />
        <span aria-hidden="true" className="documentation-spark documentation-spark-three" />
        <span aria-hidden="true" className="documentation-spark documentation-spark-four" />
        <div className="documentation-stamp border-brand-gold bg-brand-black ring-brand-gold/15 flex min-w-52 flex-col items-center gap-2 rounded-2xl border-2 px-7 py-5 text-center text-white shadow-2xl ring-4">
          <span className="bg-brand-gold/15 text-brand-gold-light ring-brand-gold/40 relative flex size-14 items-center justify-center rounded-full ring-1">
            {milestone ? (
              <Sparkles className="size-8" aria-hidden="true" />
            ) : (
              <BadgeCheck className="size-8" aria-hidden="true" />
            )}
          </span>
          <strong className="font-display text-brand-gold-light text-2xl">
            {t(milestone ? 'milestoneTitle' : 'title')}
          </strong>
          <span className="text-sm text-neutral-200">
            {t(milestone ? 'milestoneMessage' : 'message')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
