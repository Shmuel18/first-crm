'use client';

import { ChevronDown, User, X } from 'lucide-react';
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

type Option = { id: string; name: string };

type Props = {
  statusOptions: ReadonlyArray<{ id: string; name_he: string }>;
  bankOptions: ReadonlyArray<{ id: string; name_he: string }>;
  advisorOptions: ReadonlyArray<{ id: string; first_name: string | null; last_name: string | null }>;
};

const ALL = '__all';
const urlOpts = { shallow: false } as const;

export function DashboardFiltersBar({ statusOptions, bankOptions, advisorOptions }: Props) {
  const t = useTranslations('dashboard.filters');
  const tBlocker = useTranslations('case.blocker');
  const locale = useLocale();

  const [mine, setMine] = useQueryState('mine', parseAsBoolean.withDefault(false).withOptions(urlOpts));
  const [stage, setStage] = useQueryState('stage', parseAsString.withOptions(urlOpts));
  const [bank, setBank] = useQueryState('bank', parseAsString.withOptions(urlOpts));
  const [blocker, setBlocker] = useQueryState('blocker', parseAsString.withOptions(urlOpts));
  const [stuck, setStuck] = useQueryState('stuck', parseAsBoolean.withDefault(false).withOptions(urlOpts));
  const [hideClosedFrozen, setHide] = useQueryState(
    'hideClosedFrozen',
    parseAsBoolean.withDefault(true).withOptions(urlOpts),
  );
  const [advisor, setAdvisor] = useQueryState('advisor', parseAsString.withOptions(urlOpts));

  const stages: Option[] = statusOptions.map((s) => ({ id: s.id, name: s.name_he }));
  const banks: Option[] = bankOptions.map((b) => ({ id: b.id, name: b.name_he }));
  const blockers: Option[] = BLOCKER_VALUES.map((v) => ({ id: v, name: tBlocker(v) }));
  const advisors: Option[] = advisorOptions.map((a) => ({
    id: a.id,
    name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || '—',
  }));

  const anyActive =
    mine ||
    stuck ||
    !hideClosedFrozen ||
    advisor !== null ||
    stage !== null ||
    bank !== null ||
    blocker !== null;

  const clearAll = () => {
    setMine(false);
    setStuck(false);
    setHide(true);
    setAdvisor(null);
    setStage(null);
    setBank(null);
    setBlocker(null);
  };

  return (
    <div
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className="bg-white px-6 py-3 border-b border-neutral-200 flex items-center gap-2 flex-wrap"
    >
      <ChipToggle icon={User} label={t('myCases')} on={mine} onClick={() => setMine(!mine)} />
      {advisors.length > 0 && (
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
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-[#A88840] transition"
        >
          <X className="size-3.5" />
          {t('clear')}
        </button>
      )}

      <div className="flex-1" />
      <ToggleSwitch label={t('onlyStuck')} on={stuck} onClick={() => setStuck(!stuck)} />
      <ToggleSwitch label={t('hideClosedFrozen')} on={hideClosedFrozen} onClick={() => setHide(!hideClosedFrozen)} />
    </div>
  );
}

function chipClass(active: boolean): string {
  return [
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition',
    active
      ? 'border-[#C9A961] bg-[#FAF8F3] text-[#0A0A0A]'
      : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
  ].join(' ');
}

function ChipToggle({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={chipClass(on)}>
      <Icon className={on ? 'size-3.5 text-[#C9A961]' : 'size-3.5 text-neutral-400'} />
      <span>{label}</span>
    </button>
  );
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={chipClass(value !== null)}>
            <span>{selected ? selected.name : label}</span>
            <ChevronDown className="size-3.5 text-neutral-400" />
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
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm"
    >
      <span
        className={['relative w-9 h-5 rounded-full transition', on ? 'bg-[#C9A961]' : 'bg-neutral-300'].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            on ? 'end-0.5' : 'end-[18px]',
          ].join(' ')}
        />
      </span>
      <span className="text-neutral-700">{label}</span>
    </button>
  );
}
