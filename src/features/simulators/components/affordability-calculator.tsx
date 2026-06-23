'use client';

import { useMemo, useState } from 'react';

import { AlertTriangle, CheckCircle2, Gauge, Home, WalletCards } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { calculateDtiScenario } from '../domain/dti';
import { calculateLtvScenario } from '../domain/ltv';
import { calculateMaximumMortgage } from '../domain/max-mortgage';
import { calculateMonthlyPayment } from '../domain/monthly-payment';
import type { MoneyAgorot, PropertyKind, TrackInput } from '../types';
import { agorotToNis, formatMoney, formatPct, nisToAgorot } from '../utils/format';
import { NumberCell } from './number-cell';

type MoneyFieldKey = 'propertyValue' | 'equity' | 'netIncome' | 'obligations' | 'requestedMortgage';

type State = Record<MoneyFieldKey, MoneyAgorot> & {
  propertyKind: PropertyKind;
  annualRatePct: number;
  termMonths: number;
  warningDtiPct: number;
  maxDtiPct: number;
};

export type AffordabilityCalculatorInitialState = Partial<State>;

const DEFAULT_STATE: State = {
  propertyKind: 'first_home',
  propertyValue: 2_300_000_00,
  equity: 600_000_00,
  requestedMortgage: 1_700_000_00,
  netIncome: 24_000_00,
  obligations: 3_000_00,
  annualRatePct: 4.8,
  termMonths: 300,
  warningDtiPct: 35,
  maxDtiPct: 40,
};

const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function AffordabilityCalculator({
  initialState = {},
}: {
  initialState?: AffordabilityCalculatorInitialState;
}) {
  const t = useTranslations('simulators.affordability');
  const tMix = useTranslations('simulators.mix.inputs');
  const [state, setState] = useState<State>(() => ({ ...DEFAULT_STATE, ...initialState }));

  const monthlyTrack = useMemo<TrackInput>(
    () => ({
      id: 'requested',
      type: 'fixed_unlinked',
      amount: state.requestedMortgage,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    }),
    [state.annualRatePct, state.requestedMortgage, state.termMonths],
  );

  const result = useMemo(() => {
    const payment = calculateMonthlyPayment(monthlyTrack).firstPayment;
    const maxMortgage = calculateMaximumMortgage({
      netIncomeMonthly: state.netIncome,
      obligationsMonthly: state.obligations,
      propertyValue: state.propertyValue,
      equity: state.equity,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      propertyKind: state.propertyKind,
      maxTotalDebtToIncomePct: state.maxDtiPct,
      thresholds: DEFAULT_REGULATORY_THRESHOLDS,
    });
    return {
      payment,
      maxMortgage,
      dti: calculateDtiScenario({
        netIncomeMonthly: state.netIncome,
        obligationsMonthly: state.obligations,
        proposedMortgagePayment: payment,
        stressMortgagePayment: Math.round(payment * 1.15),
        maxTotalDebtToIncomePct: state.maxDtiPct,
        warningTotalDebtToIncomePct: state.warningDtiPct,
      }),
      ltv: calculateLtvScenario(
        state.propertyValue,
        state.requestedMortgage,
        state.propertyKind,
        DEFAULT_REGULATORY_THRESHOLDS,
      ),
    };
  }, [monthlyTrack, state]);

  const setMoney = (field: MoneyFieldKey, value: string) => {
    setState((current) => ({ ...current, [field]: nisToAgorot(value) }));
  };

  const setNumber = (field: keyof Pick<State, 'annualRatePct' | 'termMonths' | 'warningDtiPct' | 'maxDtiPct'>, value: string) => {
    const parsed = Number(value);
    setState((current) => ({ ...current, [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-neutral-950">{t('inputsTitle')}</h2>
            <p className="mt-1 text-sm text-neutral-500">{t('inputsSubtitle')}</p>
          </div>
          <WalletCards className="size-6 text-brand-gold-text" aria-hidden="true" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={tMix('propertyKind')}>
            <select
              className={inputClass}
              value={state.propertyKind}
              onChange={(e) => setState((current) => ({ ...current, propertyKind: parsePropertyKind(e.target.value) }))}
            >
              <option value="first_home">{tMix('propertyKinds.first_home')}</option>
              <option value="replacement">{tMix('propertyKinds.replacement')}</option>
              <option value="investment">{tMix('propertyKinds.investment')}</option>
            </select>
          </Field>
          <MoneyField label={t('propertyValue')} value={state.propertyValue} onChange={(value) => setMoney('propertyValue', value)} />
          <MoneyField label={t('equity')} value={state.equity} onChange={(value) => setMoney('equity', value)} />
          <MoneyField label={t('requestedMortgage')} value={state.requestedMortgage} onChange={(value) => setMoney('requestedMortgage', value)} />
          <MoneyField label={t('netIncome')} value={state.netIncome} onChange={(value) => setMoney('netIncome', value)} />
          <MoneyField label={t('obligations')} value={state.obligations} onChange={(value) => setMoney('obligations', value)} />
          <NumberField label={t('annualRate')} value={state.annualRatePct} onChange={(value) => setNumber('annualRatePct', value)} />
          <NumberField label={t('termMonths')} value={state.termMonths} onChange={(value) => setNumber('termMonths', value)} />
          <NumberField label={t('warningDti')} value={state.warningDtiPct} onChange={(value) => setNumber('warningDtiPct', value)} />
          <NumberField label={t('maxDti')} value={state.maxDtiPct} onChange={(value) => setNumber('maxDtiPct', value)} />
        </div>
      </section>

      <aside className="space-y-3">
        <ResultCard icon={Home} label={t('results.maximumMortgage')} value={formatMoney(result.maxMortgage.maximumMortgageAmount)} />
        <ResultCard icon={Gauge} label={t('results.monthlyPayment')} value={formatMoney(result.payment)} />
        <ResultCard icon={Gauge} label={t('results.dti')} value={formatPct(result.dti.totalDebtToIncomePct)} tone={result.dti.riskLevel === 'high' ? 'bad' : result.dti.riskLevel === 'medium' ? 'warn' : 'good'} />
        <ResultCard icon={Home} label={t('results.ltv')} value={formatPct(result.ltv.ltvPct)} tone={result.ltv.status === 'exceeded' ? 'bad' : 'good'} />
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-neutral-950">{t('decision.title')}</h3>
          <div className="mt-4 space-y-3 text-sm">
            <DecisionRow label={t('decision.paymentCap')} value={formatMoney(result.maxMortgage.paymentCap)} />
            <DecisionRow label={t('decision.binding')} value={t(`constraints.${result.maxMortgage.bindingConstraint}`)} />
            <DecisionRow label={t('decision.maxByLtv')} value={formatMoney(result.maxMortgage.maxByLtv)} />
            <DecisionRow label={t('decision.excess')} value={formatMoney(result.ltv.excessAmount)} danger={result.ltv.excessAmount > 0} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: MoneyAgorot; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <NumberCell className={inputClass} ariaLabel={label} value={agorotToNis(value)} onChange={(nis) => onChange(String(nis))} />
    </Field>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <NumberCell className={inputClass} ariaLabel={label} decimal value={value} onChange={(n) => onChange(String(n))} />
    </Field>
  );
}

function ResultCard({ icon: Icon, label, value, tone = 'neutral' }: { icon: typeof Home; label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const toneClass = {
    neutral: 'bg-white text-neutral-950',
    good: 'bg-emerald-50 text-emerald-900',
    warn: 'bg-amber-50 text-amber-900',
    bad: 'bg-rose-50 text-rose-900',
  }[tone];
  const StatusIcon = tone === 'bad' || tone === 'warn' ? AlertTriangle : CheckCircle2;
  return (
    <section className={`rounded-xl border border-neutral-200 p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3 text-sm font-medium">
        <span className="inline-flex items-center gap-2 text-neutral-600">
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </span>
        {tone !== 'neutral' && <StatusIcon className="size-4" aria-hidden="true" />}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
    </section>
  );
}

function DecisionRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <span className="text-neutral-500">{label}</span>
      <span className={danger ? 'font-semibold text-rose-700' : 'font-semibold text-neutral-950'}>{value}</span>
    </div>
  );
}

function parsePropertyKind(value: string): PropertyKind {
  return value === 'replacement' || value === 'investment' ? value : 'first_home';
}
