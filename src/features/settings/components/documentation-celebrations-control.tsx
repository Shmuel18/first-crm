'use client';

import { useState, useTransition } from 'react';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateDocumentationCelebrationsAction } from '../actions/update-documentation-celebrations';

type Props = { initialEnabled: boolean };

export function DocumentationCelebrationsControl({ initialEnabled }: Props) {
  const t = useTranslations('settings.display.celebrations');
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);

    startTransition(async () => {
      try {
        const result = await updateDocumentationCelebrationsAction(next);
        if (result.ok) {
          toast.success(t(next ? 'enabledToast' : 'disabledToast'));
          // The action skips revalidatePath — refresh so the router cache
          // doesn't keep serving the pre-toggle payload on back/forward.
          router.refresh();
          return;
        }
      } catch {
        // A dropped connection rejects the server-action call. Treat it like a
        // failed save and restore the last confirmed value below.
      }

      // Restore the last confirmed value on validation, authorization, DB or
      // network failure; the optimistic switch must never lie about its state.
      setEnabled(!next);
      toast.error(t('failed'));
    });
  };

  return (
    <section className="border-brand-gold/35 bg-brand-gold-soft/50 overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-brand-gold/20 text-brand-gold-text mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <Sparkles className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">{t('title')}</h3>
              <span className="bg-brand-black rounded-full px-2 py-0.5 text-[10px] font-medium text-white">
                {t('adminOnly')}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">{t('description')}</p>
            <p className="mt-1 text-xs font-medium text-neutral-700" aria-live="polite">
              {pending ? t('saving') : t(enabled ? 'on' : 'off')}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('title')}
          disabled={pending}
          onClick={toggle}
          className={[
            'relative h-7 w-12 shrink-0 rounded-full transition-colors',
            'focus-visible:ring-brand-gold-text/40 focus-visible:ring-2 focus-visible:outline-none',
            enabled ? 'bg-brand-gold-text' : 'bg-neutral-400',
            pending ? 'cursor-wait opacity-70' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-all',
              enabled ? 'start-[1.375rem]' : 'start-0.5',
            ].join(' ')}
          />
        </button>
      </div>
    </section>
  );
}
