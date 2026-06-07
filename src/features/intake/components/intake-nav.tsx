'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

type Props = {
  step: number;
  totalSteps: number;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

const GOLD_CTA =
  'h-11 bg-brand-gold px-6 text-base font-bold text-brand-black hover:bg-brand-gold-hover';

export function IntakeNav({ step, totalSteps, pending, onBack, onNext, onSubmit }: Props) {
  const t = useTranslations('intake.nav');
  const isLast = step >= totalSteps;
  const isFirst = step <= 1;

  return (
    <div className="mt-8 flex items-center justify-between gap-4 border-t border-neutral-100 pt-6">
      <Button
        type="button"
        variant="outline"
        className="h-11 px-5"
        disabled={isFirst || pending}
        onClick={onBack}
      >
        {t('back')}
      </Button>
      {isLast ? (
        <Button type="button" className={GOLD_CTA} disabled={pending} onClick={onSubmit}>
          {pending ? t('submitting') : t('submit')}
        </Button>
      ) : (
        <Button type="button" className={GOLD_CTA} onClick={onNext}>
          {t('next')}
        </Button>
      )}
    </div>
  );
}
