'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { AmortizationTable } from './amortization-table';
import { CollapsibleSection } from './collapsible-section';
import { MixChart } from './mix-chart';
import { MonthStatePanel } from './month-state-panel';
import { PaymentBreakdownChart } from './payment-breakdown-chart';

import type { MixResult, MoneyAgorot } from '../types';

type Props = { result: MixResult; mortgageAmount: MoneyAgorot; active: boolean };
type BlockId = 'monthState' | 'balance' | 'breakdown' | 'amortization';

/**
 * The collapsible analysis blocks below the mix. Each opens/closes on its own;
 * the amortization table starts collapsed to keep the page calm. Charts mount
 * only when their block is open AND the tab is active (so hidden tabs never
 * spin up an off-screen Recharts container).
 */
export function AnalysisSection({ result, mortgageAmount, active }: Props) {
  const t = useTranslations('simulators.mix');
  const [open, setOpen] = useState<Record<BlockId, boolean>>({
    monthState: true,
    balance: true,
    breakdown: true,
    amortization: false,
  });
  const toggle = (id: BlockId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-3">
      <CollapsibleSection title={t('monthState.title')} open={open.monthState} onToggle={() => toggle('monthState')}>
        <MonthStatePanel result={result} mortgageAmount={mortgageAmount} />
      </CollapsibleSection>
      <CollapsibleSection title={t('results.balanceCurve')} open={open.balance} onToggle={() => toggle('balance')}>
        {active ? <MixChart points={result.balanceCurve} /> : null}
      </CollapsibleSection>
      <CollapsibleSection title={t('breakdown.title')} open={open.breakdown} onToggle={() => toggle('breakdown')}>
        {active ? <PaymentBreakdownChart principalCurve={result.principalCurve} interestCurve={result.interestCurve} /> : null}
      </CollapsibleSection>
      <CollapsibleSection title={t('table.title')} open={open.amortization} onToggle={() => toggle('amortization')}>
        <AmortizationTable result={result} />
      </CollapsibleSection>
    </div>
  );
}
