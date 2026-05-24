'use client';

import { useState } from 'react';

import { Rows3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ROW_DENSITIES, setRowDensity, useRowDensity, type RowDensity } from '../hooks/use-row-density';

export function RowDensityControl() {
  const t = useTranslations('dashboard.density');
  const density = useRowDensity();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t('label')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 text-sm text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50 transition"
          >
            <Rows3 className="size-3.5 text-neutral-500" aria-hidden="true" />
            <span className="hidden sm:inline">{t(density)}</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(v) => {
            setRowDensity(v as RowDensity);
            setOpen(false);
          }}
        >
          {ROW_DENSITIES.map((d) => (
            <DropdownMenuRadioItem key={d} value={d}>
              {t(d)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
