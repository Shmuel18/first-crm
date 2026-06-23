'use client';

import { useMemo, useState } from 'react';

import { Calculator, Landmark, ReceiptText, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  calculatePurchaseTax,
  type PurchaseTaxBracket,
  type PurchaseTaxBuyerProfile,
} from '../domain/purchase-tax';
import { calculateClosingCosts, type ClosingCostLineItem } from '../domain/closing-costs';
import type { MoneyAgorot } from '../types';
import { agorotToNis, formatMoney, nisToAgorot } from '../utils/format';
import { NumberCell } from './number-cell';

type State = {
  profile: PurchaseTaxBuyerProfile;
  propertyValue: MoneyAgorot;
  mortgageAmount: MoneyAgorot;
  equity: MoneyAgorot;
  availableCash: MoneyAgorot;
  ownershipSharePct: number;
  lawyerPct: number;
  brokerPct: number;
  appraiserAmount: MoneyAgorot;
  bankOpeningPct: number;
  movingAmount: MoneyAgorot;
};

export type TaxCostsCalculatorInitialState = Partial<State>;

const DEFAULT_STATE: State = {
  profile: 'single_home',
  propertyValue: 2_300_000_00,
  mortgageAmount: 1_700_000_00,
  equity: 600_000_00,
  availableCash: 680_000_00,
  ownershipSharePct: 100,
  lawyerPct: 0.5,
  brokerPct: 1,
  appraiserAmount: 2_500_00,
  bankOpeningPct: 0.25,
  movingAmount: 8_000_00,
};

const SINGLE_HOME_2025_TO_2028: readonly PurchaseTaxBracket[] = [
  { fromAmount: 0, toAmount: 1_978_745_00, ratePct: 0 },
  { fromAmount: 1_978_745_00, toAmount: 2_347_040_00, ratePct: 3.5 },
  { fromAmount: 2_347_040_00, toAmount: 6_055_070_00, ratePct: 5 },
  { fromAmount: 6_055_070_00, toAmount: 20_183_565_00, ratePct: 8 },
  { fromAmount: 20_183_565_00, toAmount: null, ratePct: 10 },
];

const ADDITIONAL_HOME_2026: readonly PurchaseTaxBracket[] = [
  { fromAmount: 0, toAmount: 6_055_070_00, ratePct: 8 },
  { fromAmount: 6_055_070_00, toAmount: null, ratePct: 10 },
];

const FLAT_SIX_PCT: readonly PurchaseTaxBracket[] = [{ fromAmount: 0, toAmount: null, ratePct: 6 }];

const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function TaxCostsCalculator({
  initialState = {},
}: {
  initialState?: TaxCostsCalculatorInitialState;
}) {
  const t = useTranslations('simulators.tax');
  const [state, setState] = useState<State>(() => ({ ...DEFAULT_STATE, ...initialState }));

  const brackets = useMemo(() => bracketsFor(state.profile), [state.profile]);
  const purchaseTax = useMemo(
    () => calculatePurchaseTax(state.propertyValue, brackets, state.ownershipSharePct),
    [brackets, state.ownershipSharePct, state.propertyValue],
  );
  const costs = useMemo(() => {
    const items: ClosingCostLineItem[] = [
      { id: 'purchase_tax', label: t('costs.purchaseTax'), amount: purchaseTax.totalTax, baseAmount: null, ratePct: null },
      { id: 'lawyer', label: t('costs.lawyer'), amount: null, baseAmount: state.propertyValue, ratePct: state.lawyerPct },
      { id: 'broker', label: t('costs.broker'), amount: null, baseAmount: state.propertyValue, ratePct: state.brokerPct },
      { id: 'appraiser', label: t('costs.appraiser'), amount: state.appraiserAmount, baseAmount: null, ratePct: null },
      { id: 'bank_opening', label: t('costs.bankOpening'), amount: null, baseAmount: state.mortgageAmount, ratePct: state.bankOpeningPct },
      { id: 'moving', label: t('costs.moving'), amount: state.movingAmount, baseAmount: null, ratePct: null },
    ];
    return calculateClosingCosts(state.equity, state.availableCash, items);
  }, [purchaseTax.totalTax, state, t]);

  const setMoney = (field: keyof Pick<State, 'propertyValue' | 'mortgageAmount' | 'equity' | 'availableCash' | 'appraiserAmount' | 'movingAmount'>, value: string) => {
    setState((current) => ({ ...current, [field]: nisToAgorot(value) }));
  };
  const setNumber = (field: keyof Pick<State, 'ownershipSharePct' | 'lawyerPct' | 'brokerPct' | 'bankOpeningPct'>, value: string) => {
    const parsed = Number(value);
    setState((current) => ({ ...current, [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-neutral-950">{t('inputsTitle')}</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">{t('inputsSubtitle')}</p>
          </div>
          <ReceiptText className="size-6 text-brand-gold-text" aria-hidden="true" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('buyerProfile')}>
            <select
              className={inputClass}
              value={state.profile}
              onChange={(e) => setState((current) => ({ ...current, profile: parseProfile(e.target.value) }))}
            >
              <option value="single_home">{t('profiles.single_home')}</option>
              <option value="replacement_home">{t('profiles.replacement_home')}</option>
              <option value="additional_home">{t('profiles.additional_home')}</option>
              <option value="land">{t('profiles.land')}</option>
              <option value="commercial">{t('profiles.commercial')}</option>
            </select>
          </Field>
          <NumberField label={t('ownershipShare')} value={state.ownershipSharePct} onChange={(value) => setNumber('ownershipSharePct', value)} />
          <MoneyField label={t('propertyValue')} value={state.propertyValue} onChange={(value) => setMoney('propertyValue', value)} />
          <MoneyField label={t('mortgageAmount')} value={state.mortgageAmount} onChange={(value) => setMoney('mortgageAmount', value)} />
          <MoneyField label={t('equity')} value={state.equity} onChange={(value) => setMoney('equity', value)} />
          <MoneyField label={t('availableCash')} value={state.availableCash} onChange={(value) => setMoney('availableCash', value)} />
          <NumberField label={t('lawyerPct')} value={state.lawyerPct} onChange={(value) => setNumber('lawyerPct', value)} />
          <NumberField label={t('brokerPct')} value={state.brokerPct} onChange={(value) => setNumber('brokerPct', value)} />
          <NumberField label={t('bankOpeningPct')} value={state.bankOpeningPct} onChange={(value) => setNumber('bankOpeningPct', value)} />
          <MoneyField label={t('appraiserAmount')} value={state.appraiserAmount} onChange={(value) => setMoney('appraiserAmount', value)} />
          <MoneyField label={t('movingAmount')} value={state.movingAmount} onChange={(value) => setMoney('movingAmount', value)} />
        </div>
      </section>

      <aside className="space-y-3">
        <SummaryCard icon={Landmark} label={t('summary.purchaseTax')} value={formatMoney(purchaseTax.totalTax)} />
        <SummaryCard icon={Calculator} label={t('summary.totalCosts')} value={formatMoney(costs.totalCosts)} />
        <SummaryCard icon={Wallet} label={t('summary.cashToClose')} value={formatMoney(costs.cashToClose)} />
        <SummaryCard icon={Wallet} label={t('summary.financingGap')} value={formatMoney(costs.financingGap)} tone={costs.financingGap > 0 ? 'bad' : 'good'} />
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-neutral-950">{t('breakdownTitle')}</h3>
          <div className="mt-4 space-y-3">
            {costs.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 text-sm last:border-0 last:pb-0">
                <span className="text-neutral-500">{item.label}</span>
                <span className="font-semibold text-neutral-950">{formatMoney(item.calculatedAmount)}</span>
              </div>
            ))}
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

function SummaryCard({ icon: Icon, label, value, tone = 'neutral' }: { icon: typeof Wallet; label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const classes =
    tone === 'bad'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : tone === 'good'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-neutral-200 bg-white text-neutral-950';
  return (
    <section className={`rounded-xl border p-5 shadow-sm ${classes}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-600">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
    </section>
  );
}

function bracketsFor(profile: PurchaseTaxBuyerProfile): readonly PurchaseTaxBracket[] {
  if (profile === 'single_home' || profile === 'replacement_home') return SINGLE_HOME_2025_TO_2028;
  if (profile === 'additional_home') return ADDITIONAL_HOME_2026;
  return FLAT_SIX_PCT;
}

function parseProfile(value: string): PurchaseTaxBuyerProfile {
  if (value === 'replacement_home' || value === 'additional_home' || value === 'land' || value === 'commercial') {
    return value;
  }
  return 'single_home';
}
