'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CALENDAR_LAYERS, type CalendarLayer } from '../types';

import { LAYER_STYLE } from './calendar-chip';

export type AdvisorChoice = { id: string; name: string };

type Props = {
  layers: ReadonlySet<CalendarLayer>;
  onToggleLayer: (layer: CalendarLayer) => void;
  /** Shown only when the viewer may look at other advisors' calendars. */
  advisors: ReadonlyArray<AdvisorChoice>;
  advisorIds: ReadonlySet<string>;
  onToggleAdvisor: (id: string) => void;
};

/** Layer toggles (with their colour as the legend) + the advisor filter. */
export function CalendarFilters({ layers, onToggleLayer, advisors, advisorIds, onToggleAdvisor }: Props) {
  const t = useTranslations('calendar');
  const active = CALENDAR_LAYERS.length - layers.size + advisorIds.size;

  return (
    // Native <details>: an accessible disclosure with no popover dependency.
    <details className="relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 hover:border-neutral-400 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        {t('filters')}
        {active > 0 && (
          <span className="rounded-full bg-brand-gold px-1.5 text-[10px] font-semibold text-brand-black">{active}</span>
        )}
      </summary>
      <div className="absolute end-0 z-30 mt-1 w-64 space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-semibold text-neutral-700">{t('layersTitle')}</legend>
          {CALENDAR_LAYERS.map((layer) => (
            <label key={layer} className="flex items-center gap-2 text-xs text-neutral-700">
              <input type="checkbox" checked={layers.has(layer)} onChange={() => onToggleLayer(layer)} />
              <span className={`size-3 shrink-0 rounded-sm border ${LAYER_STYLE[layer]}`} aria-hidden="true" />
              {t(`layers.${layer}`)}
            </label>
          ))}
        </fieldset>
        {advisors.length > 0 && (
          <fieldset className="space-y-1.5 border-t border-neutral-100 pt-2">
            <legend className="mb-1 text-xs font-semibold text-neutral-700">{t('advisorsTitle')}</legend>
            <p className="text-[11px] text-neutral-500">{t('advisorsHint')}</p>
            {advisors.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-xs text-neutral-700">
                <input type="checkbox" checked={advisorIds.has(a.id)} onChange={() => onToggleAdvisor(a.id)} />
                {a.name}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </details>
  );
}
