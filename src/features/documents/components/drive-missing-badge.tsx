'use client';

import { CloudOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

type Props = {
  hoursLeft: number;
  /** 'chip' = tile/row corner marker; 'notice' = full-width bar in the modal. */
  variant?: 'chip' | 'notice';
  className?: string;
};

/** Amber marker for a doc whose Drive file was deleted and is pending removal. */
export function DriveMissingBadge({ hoursLeft, variant = 'chip', className }: Props) {
  const t = useTranslations('documents.driveMissing');
  const label = hoursLeft > 0 ? t('pending', { hours: hoursLeft }) : t('pendingSoon');

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200',
        variant === 'chip' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1.5 text-xs',
        className,
      )}
    >
      <CloudOff className={variant === 'chip' ? 'size-3 shrink-0' : 'size-4 shrink-0'} />
      <span className="truncate">{label}</span>
    </span>
  );
}
