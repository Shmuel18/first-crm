'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

type CaseStatusBadgeProps = {
  name: string | null | undefined;
  color: string | null | undefined;
  interactive?: boolean;
};

export function CaseStatusBadge({ name, color, interactive }: CaseStatusBadgeProps) {
  const tc = useTranslations('common');

  if (!name) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">
        {tc('noStatus')}
      </span>
    );
  }

  const bg = color ? `${color}25` : '#F5F5F5';
  const fg = color ?? '#525252';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {name}
      {interactive && <ChevronDown className="size-3 opacity-60" />}
    </span>
  );
}
