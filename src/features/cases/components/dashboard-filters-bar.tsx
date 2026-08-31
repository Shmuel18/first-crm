'use client';

import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';

import { MultiSelectFilter, type MultiSelectOption } from '@/components/shared/multi-select-filter';
import { formatPersonName } from '@/lib/utils/person-name';

import { DashboardExportButtons } from './dashboard-export-buttons';
import { RowDensityControl } from './row-density-control';
import { TARGET_DATE_FILTER_VALUES, type TargetDateFilter } from '../domain/target-date';

type Props = {
  statusOptions: ReadonlyArray<{ id: string; name_he: string }>;
  bankOptions: ReadonlyArray<{ id: string; name_he: string }>;
  advisorOptions: ReadonlyArray<{ id: string; first_name: string | null; last_name: string | null }>;
  // Only users who can see other advisors' cases (view_all_cases) get the
  // advisor picker; a regular advisor only sees their own cases anyway.
  canFilterByAdvisor: boolean;
  /** Distinct referrer names (cases.referrer_name) for the picker. */
  referrerOptions: ReadonlyArray<string>;
  /** Manager-only: the referrer filter shows only when true. */
  canFilterByReferrer: boolean;
  /** Distinct insurance-agent names (cases.insurance_agent_name). Not
   *  role-gated — the caller derives them from the viewer's own visible
   *  cases, so the picker is empty until they have one on a case. */
  insuranceAgentOptions: ReadonlyArray<string>;
};

const urlOpts = { shallow: false } as const;
// Every picker is multi-select: nuqs writes one comma-joined param
// (`?stage=a,b`), which the server mirrors via parseQueryList. A single legacy
// value (`?stage=a`) still parses, so old links and the "back to the list"
// memory keep working.
const listParser = parseAsArrayOf(parseAsString).withOptions(urlOpts);
const targetDateParser = parseAsArrayOf(
  parseAsStringEnum<TargetDateFilter>([...TARGET_DATE_FILTER_VALUES]),
).withOptions(urlOpts);

const EMPTY: string[] = [];

/** Empty selection clears the param instead of leaving `?stage=` behind. */
function orNull<T>(next: T[]): T[] | null {
  return next.length > 0 ? next : null;
}

function isTargetDateValue(value: string): value is TargetDateFilter {
  return (TARGET_DATE_FILTER_VALUES as readonly string[]).includes(value);
}

export function DashboardFiltersBar({
  statusOptions,
  bankOptions,
  advisorOptions,
  canFilterByAdvisor,
  referrerOptions,
  canFilterByReferrer,
  insuranceAgentOptions,
}: Props) {
  const t = useTranslations('dashboard.filters');
  const locale = useLocale();

  const [advisor, setAdvisor] = useQueryState('advisor', listParser);
  const [stage, setStage] = useQueryState('stage', listParser);
  const [bank, setBank] = useQueryState('bank', listParser);
  const [referrer, setReferrer] = useQueryState('referrer', listParser);
  const [insuranceAgent, setInsuranceAgent] = useQueryState('insuranceAgent', listParser);
  const [targetDate, setTargetDate] = useQueryState('targetDate', targetDateParser);
  // The free-text search input lives in the view-selector bar above and owns
  // its own `?q=` state — we deliberately don't read or clear it from here.

  const stages: MultiSelectOption[] = statusOptions.map((s) => ({ id: s.id, name: s.name_he }));
  const banks: MultiSelectOption[] = bankOptions.map((b) => ({ id: b.id, name: b.name_he }));
  const targetDates: MultiSelectOption[] = [
    { id: 'overdue', name: t('targetDate.overdue') },
    { id: 'week', name: t('targetDate.week') },
    { id: 'none', name: t('targetDate.none') },
  ];
  const advisors: MultiSelectOption[] = advisorOptions.map((a) => ({
    id: a.id,
    name: formatPersonName(a.first_name, a.last_name) || '—',
  }));

  // Referrer / insurance-agent values are free text — the id IS the name
  // (exact-match filter).
  const referrers: MultiSelectOption[] = referrerOptions.map((r) => ({ id: r, name: r }));
  const insuranceAgents: MultiSelectOption[] = insuranceAgentOptions.map((a) => ({ id: a, name: a }));

  const showAdvisor = canFilterByAdvisor && advisors.length > 0;
  const showReferrer = canFilterByReferrer && referrers.length > 0;
  const showInsuranceAgent = insuranceAgents.length > 0;

  // The free-text search lives in a sibling component (the view selector bar
  // above), so we deliberately leave `query` alone here — it would be a
  // surprise to wipe text the user typed in a different bar.
  const anyActive = [advisor, stage, bank, referrer, insuranceAgent, targetDate].some(
    (v) => v !== null && v.length > 0,
  );

  const clearAll = () => {
    setAdvisor(null);
    setStage(null);
    setBank(null);
    setReferrer(null);
    setInsuranceAgent(null);
    setTargetDate(null);
  };

  return (
    <div
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className="bg-white px-6 py-2.5 border-b border-neutral-200 flex items-center gap-2 flex-wrap"
    >
      {/* === FILTERING (what data) === */}
      {showAdvisor && (
        <MultiSelectFilter
          label={t('advisor')}
          values={advisor ?? EMPTY}
          onChange={(next) => setAdvisor(orNull(next))}
          options={advisors}
          allLabel={t('all')}
        />
      )}
      <MultiSelectFilter
        label={t('stage')}
        values={stage ?? EMPTY}
        onChange={(next) => setStage(orNull(next))}
        options={stages}
        allLabel={t('all')}
      />
      <MultiSelectFilter
        label={t('bank')}
        values={bank ?? EMPTY}
        onChange={(next) => setBank(orNull(next))}
        options={banks}
        allLabel={t('all')}
      />
      {showReferrer && (
        <MultiSelectFilter
          label={t('referrer')}
          values={referrer ?? EMPTY}
          onChange={(next) => setReferrer(orNull(next))}
          options={referrers}
          allLabel={t('all')}
        />
      )}
      {showInsuranceAgent && (
        <MultiSelectFilter
          label={t('insuranceAgent')}
          values={insuranceAgent ?? EMPTY}
          onChange={(next) => setInsuranceAgent(orNull(next))}
          options={insuranceAgents}
          allLabel={t('all')}
        />
      )}
      <MultiSelectFilter
        label={t('targetDate.label')}
        values={targetDate ?? EMPTY}
        onChange={(next) => setTargetDate(orNull(next.filter(isTargetDateValue)))}
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

      <div className="flex-1" />

      {/* === SECONDARY (density + export) === */}
      <div className="hidden md:block">
        <RowDensityControl />
      </div>
      <DashboardExportButtons />
    </div>
  );
}
