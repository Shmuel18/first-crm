import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { DOCUMENT_STATUS_META, type DocumentStatus } from '../types';

type Props = {
  status: DocumentStatus | 'missing';
  size?: 'sm' | 'md';
  className?: string;
};

const META_WITH_MISSING: Record<
  DocumentStatus | 'missing',
  { dot: string; bg: string; text: string }
> = {
  ...DOCUMENT_STATUS_META,
  missing: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-800' },
};

export function DocumentStatusChip({ status, size = 'md', className }: Props) {
  const t = useTranslations('documents.status');
  const meta = META_WITH_MISSING[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {t(status)}
    </span>
  );
}
