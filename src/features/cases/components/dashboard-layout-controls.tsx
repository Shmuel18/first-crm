'use client';

import { ChevronDown, LayoutList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { CASE_LAYOUTS, type CaseLayout } from '../domain/case-layout';

import { DashboardExportButtons } from './dashboard-export-buttons';

const SORT_LAYOUTS: CaseLayout[] = ['default', 'alphabetical', 'pipeline'];
const GROUP_LAYOUTS: CaseLayout[] = ['by-advisor', 'by-bank', 'by-stage'];

export function DashboardLayoutControls() {
  const t = useTranslations('dashboard.layout');
  // Lives in the URL so a layout can be shared via link, not just remembered
  // locally. shallow:false reloads the server component once chosen so any
  // future server-side filters tied to layout will also apply.
  const [layout, setLayout] = useQueryState(
    'layout',
    parseAsStringEnum(CASE_LAYOUTS as unknown as CaseLayout[])
      .withDefault('default')
      .withOptions({ shallow: false }),
  );

  return (
    <div className="bg-white px-6 py-2 border-b border-neutral-200 flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t('triggerLabel')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/50 transition"
            >
              <LayoutList className="size-3.5 text-neutral-500" aria-hidden="true" />
              <span>
                {t('triggerPrefix')}:{' '}
                <span className="font-medium text-neutral-900">{t(`options.${layout}`)}</span>
              </span>
              <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuRadioGroup
            value={layout}
            onValueChange={(v) => setLayout(v as CaseLayout)}
          >
            <DropdownMenuLabel>{t('sortGroup')}</DropdownMenuLabel>
            {SORT_LAYOUTS.map((l) => (
              <DropdownMenuRadioItem key={l} value={l}>
                {t(`options.${l}`)}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('groupGroup')}</DropdownMenuLabel>
            {GROUP_LAYOUTS.map((l) => (
              <DropdownMenuRadioItem key={l} value={l}>
                {t(`options.${l}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />
      <DashboardExportButtons />
    </div>
  );
}
