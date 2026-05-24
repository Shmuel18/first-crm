'use client';

import { ChevronDown, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { BLOCKER_VALUES } from '../domain/case-filters';
import { RowDensityControl } from './row-density-control';

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

export function DashboardFiltersBar({
  statusOptions,
  bankOptions,
  advisorOptions,
  canFilterByAdvisor,
  isArchiveView = false,
}: Props) {
  const t = useTranslations('dashboard.filters');
  const tBlocker = useTranslations('case.blocker');
  const locale = useLocale();

  const [advisor, setAdvisor] = useQueryState('advisor', parseAsString.withOptions(urlOpts));
  const [stage, setStage] = useQueryState('stage', parseAsString.withOptions(urlOpts));
  const [bank, setBank] = useQueryState('bank', parseAsString.withOptions(urlOpts));
  const [blocker, setBlocker] = useQueryState('blocker', parseAsString.withOptions(urlOpts));
  const [hideClosedFrozen, setHide] = useQueryState(
    'hideClosedFrozen',
    parseAsBoolean.withDefault(true).withOptions(urlOpts),
  );
  // Free-text search filters client-side (see useCaseQueryFilter), so it uses a
  // shallow URL update — no server round-trip, instant as you type.
  const [query, setQuery] = useQueryState('q', parseAsString.withOptions({ shallow: true }));

  const stages: Option[] = statusOptions.map((s) => ({ id: s.id, name: s.name_he }));
  const banks: Option[] = bankOptions.map((b) => ({ id: b.id, name: b.name_he }));
  const blockers: Option[] = BLOCKER_VALUES.map((v) => ({ id: v, name: tBlocker(v) }));
  const advisors: Option[] = advisorOptions.map((a) => ({
    id: a.id,
    name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || '—',
  }));

  const showAdvisor = canFilterByAdvisor && advisors.length > 0;

  const anyActive =
    Boolean(query) ||
    !hideClosedFrozen ||
    advisor !== null ||
    stage !== null ||
    bank !== null ||
    blocker !== null;

  const clearAll = () => {
    setQuery(null);
    setHide(true);
    setAdvisor(null);
    setStage(null);
    setBank(null);
    setBlocker(null);
  };

  return (
    <div
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className="bg-white px-6 py-2.5 border-b border-neutral-200 flex items-center gap-2 flex-wrap"
    >
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
      <FilterSelect label={t('blocker')} value={blocker} onChange={setBlocker} options={blockers} allLabel={t('all')} />

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-600 hover:text-[#A88840] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 rounded transition"
        >
          <X className="size-3.5" aria-hidden="true" />
          {t('clear')}
        </button>
      )}

      <div className="flex-1" />
      <div className="hidden md:block">
        <RowDensityControl />
      </div>
      {!isArchiveView && (
        <ToggleSwitch
          label={t('hideClosedFrozen')}
          on={hideClosedFrozen}
          onClick={() => setHide(!hideClosedFrozen)}
        />
      )}
    </div>
  );
}

function chipClass(active: boolean): string {
  return [
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40',
    active
      ? 'border-[#A88840] bg-[#FAF8F3] text-[#0A0A0A]'
      : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
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
            <ChevronDown className="size-3.5 text-neutral-500" aria-hidden="true" />
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

function ToggleSwitch({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88840]/40 rounded-full"
    >
      <span
        aria-hidden="true"
        className={['relative w-9 h-5 rounded-full transition', on ? 'bg-[#A88840]' : 'bg-neutral-400'].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            on ? 'end-0.5' : 'end-[18px]',
          ].join(' ')}
        />
      </span>
      <span aria-hidden="true" className="text-neutral-700">
        {label}
      </span>
    </button>
  );
}
