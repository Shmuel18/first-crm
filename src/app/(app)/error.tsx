'use client';

import { useEffect } from 'react';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="font-display text-xl text-neutral-900">{t('title')}</h1>
      <p className="mt-1 mb-5 text-sm text-neutral-500">{t('description')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
