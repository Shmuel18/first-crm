'use client';

import { ChevronDown, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatPersonName } from '@/lib/utils/person-name';

import { DashboardExportButtons } from './dashboard-export-buttons';
import { RowDensityControl } from './row-density-control';
import { TARGET_DATE_FILTER_VALUES } from '../domain/target-date';

type Option = { id: string; name: string };

type Props = {
  statusOptions: ReadonlyArray<{ id: string; name_he: string }>;
  bankOptions: ReadonlyArray<{ id: string; name_he: string }>;
  advisorOptions: ReadonlyArray<{ id: string; first_name: string | null; last_name: string | null }>;
  // Only users who can see other advisors' cases (view_all_cases) get the
  // advisor picker; a regular advisor only sees their own cases anyway.
  canFilterByAdvisor: boolean;
  // The archive intentionally shows closed/frozen cases, so the
  // "hide closed & frozen" toggle is suppressed there.
  isArchiveView?: boolean;
};

const ALL = '__all';
const urlOpts = { shallow: false } as const;

function isTargetDateValue(value: string | null): value is (typeof TARGET_DATE_FILTER_VALUES)[number] {
  return (TARGET_DATE_FILTER_VALUES as readonly string[]).includes(value ?? '');
}

export function DashboardFiltersBar({
  statusOptions,
  bankOptions,
  advisorOptions,
  canFilterByAdvisor,
  isArchiveView = false,
}: Props) {
  const t = useTranslations('dashboard.filters');
  const locale = useLocale();

  const [advisor, setAdvisor] = useQueryState('advisor', parseAsString.withOptions(urlOpts));
  const [stage, setStage] = useQueryState('stage', parseAsString.withOptions(urlOpts));
  const [bank, setBank] = useQueryState('bank', parseAsString.withOptions(urlOpts));
  const [targetDate, setTargetDate] = useQueryState(
    'targetDate',
    parseAsStringEnum([...TARGET_DATE_FILTER_VALUES]).withOptions(urlOpts),
  );
  const [hideClosedFrozen, setHide] = useQueryState(
    'hideClosedFrozen',
    parseAsBoolean.withDefault(true).withOptions(urlOpts),
  );
  // The free-text search input lives in the view-selector bar above and owns
  // its own `?q=` state — we deliberately don't read or clear it from here.

  const stages: Option[] = statusOptions.map((s) => ({ id: s.id, name: s.name_he }));
  const banks: Option[] = bankOptions.map((b) => ({ id: b.id, name: b.name_he }));
  const targetDates: Option[] = [
    { id: 'overdue', name: t('targetDate.overdue') },
    { id: 'week', name: t('targetDate.week') },
    { id: 'none', name: t('targetDate.none') },
  ];
  const advisors: Option[] = advisorOptions.map((a) => ({
    id: a.id,
    name: formatPersonName(a.first_name, a.last_name) || '—',
  }));

  const showAdvisor = canFilterByAdvisor && advisors.length > 0;

  // The "hide completed & frozen" toggle is an independent display preference,
  // not a filter the user "applied" — clearing the chips shouldn't reset it,
  // and toggling it off shouldn't surface the clear button.
  //
  // The free-text search lives in a sibling component (the view selector bar
  // above), so we deliberately leave `query` alone here — it would be a
  // surprise to wipe text the user typed in a different bar.
  const anyActive = advisor !== null || stage !== null || bank !== null || targetDate !== null;

  const clearAll = () => {
    setAdvisor(null);
    setStage(null);
    setBank(null);
    setTargetDate(null);
  };

  return (
    <div
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className="bg-white px-6 py-2.5 border-b border-neutral-200 flex items-center gap-2 flex-wrap"
    >
      {/* === FILTERING (what data) === */}
      {showAdvisor && (
        <FilterSelect
          label={t('advisor')}
          value={advisor}
          onChange={setAdvisor}
          options={advisors}
          allLabel={t('all')}
        />
      )}
      <FilterSelect label={t('stage')} value={stage} onChange={setStage} options={stages} allLabel={t('all')} />
      <FilterSelect label={t('bank')} value={bank} onChange={setBank} options={banks} allLabel={t('all')} />
      <FilterSelect
        label={t('targetDate.label')}
        value={targetDate}
        onChange={(next) => setTargetDate(isTargetDateValue(next) ? next : null)}
        options={targetDates}
        allLabel={t('all')}
      />
      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-600 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded transition"
        >
          <X className="size-3.5" aria-hidden="true" />
          {t('clear')}
        </button>
      )}

      {!isArchiveView && (
        <HideClosedCheckbox
          label={t('hideClosedFrozen')}
          on={hideClosedFrozen}
          onChange={(next) => setHide(next)}
        />
      )}

      <div className="flex-1" />

      {/* === SECONDARY (density + export) === */}
      <div className="hidden md:block">
        <RowDensityControl />
      </div>
      <DashboardExportButtons />
    </div>
  );
}

function chipClass(active: boolean): string {
  return [
    'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40',
    active
      ? 'border-brand-gold-text bg-brand-gold-soft text-brand-black font-medium'
      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
  ].join(' ');
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: Option[];
  allLabel: string;
}) {
  const selected = options.find((o) => o.id === value);
  const accessibleName = selected ? `${label}: ${selected.name}` : label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={accessibleName}
            aria-pressed={value !== null}
            className={chipClass(value !== null)}
          >
            <span>{selected ? selected.name : label}</span>
            <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-44 max-h-72">
        <DropdownMenuRadioGroup
          value={value ?? ALL}
          onValueChange={(v) => onChange(v === ALL ? null : v)}
        >
          <DropdownMenuRadioItem value={ALL}>{allLabel}</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.id} value={o.id}>
              {o.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HideClosedCheckbox({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded accent-brand-gold-text cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
      />
      {label}
    </label>
  );
}
