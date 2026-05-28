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
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
        {tc('noStatus')}
      </span>
    );
  }

  // The status colour drives a faint tint background + a saturated dot, while
  // the label stays a fixed dark neutral. Using the raw hue as the text colour
  // (the previous approach) failed WCAG AA for any pale/medium status colour —
  // e.g. a gold status rendered ~2.2:1. The dot preserves the colour cue.
  const tint = color ? `${color}25` : '#F5F5F5';
  const dot = color ?? '#737373';

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap text-neutral-900"
      style={{ backgroundColor: tint }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
      />
      {name}
      {interactive && <ChevronDown className="size-3 opacity-60" />}
    </span>
  );
}
