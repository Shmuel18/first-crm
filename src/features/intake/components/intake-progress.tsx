'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

const STEP_KEYS = ['composition', 'personal', 'property', 'income', 'story'] as const;

export function IntakeProgress({ step }: { step: number }) {
  const t = useTranslations('intake.steps');

  return (
    <ol className="mx-auto flex max-w-2xl items-start">
      {STEP_KEYS.map((key, i) => {
        const n = i + 1;
        const completed = n < step;
        const active = n === step;
        return (
          <li key={key} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-4 h-0.5 w-full end-1/2',
                  completed || active ? 'bg-brand-gold' : 'bg-neutral-200',
                )}
              />
            )}
            <span
              className={cn(
                'z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                completed
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : active
                    ? 'border-brand-gold bg-brand-gold text-brand-black ring-4 ring-brand-gold/20'
                    : 'border-neutral-200 bg-white text-neutral-400',
              )}
            >
              {completed ? <Check className="size-4" /> : n}
            </span>
            <span
              className={cn(
                'mt-2 hidden text-xs font-medium sm:block',
                active || completed ? 'text-neutral-900' : 'text-neutral-400',
              )}
            >
              {t(key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
