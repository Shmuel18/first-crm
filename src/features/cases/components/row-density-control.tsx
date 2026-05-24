'use client';

import { Menu, Rows2, Rows3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  ROW_DENSITIES,
  setRowDensity,
  useRowDensity,
  type RowDensity,
} from '../hooks/use-row-density';

// Icon per density. Higher visible-rows-in-icon ↔ tighter spacing in the table.
const DENSITY_ICON: Record<RowDensity, React.ComponentType<{ className?: string }>> = {
  compact: Menu, // hamburger feels like a tight list
  normal: Rows3,
  comfortable: Rows2, // fewer/larger rows = more breathing room
};

export function RowDensityControl() {
  const t = useTranslations('dashboard.density');
  const density = useRowDensity();

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="inline-flex items-center bg-white border border-neutral-200 rounded-md p-0.5"
    >
      {ROW_DENSITIES.map((d) => {
        const Icon = DENSITY_ICON[d];
        const selected = density === d;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(d)}
            title={t(d)}
            onClick={() => setRowDensity(d)}
            className={[
              'size-7 rounded inline-flex items-center justify-center transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50',
              selected
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50',
            ].join(' ')}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
