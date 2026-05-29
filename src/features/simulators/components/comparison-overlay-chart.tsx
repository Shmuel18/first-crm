'use client';

import { useTranslations } from 'next-intl';

import type { MixComparisonResult } from '../domain/mix-compare';
import { SeriesOverlayChart } from './series-overlay-chart';

type Props = { comparison: MixComparisonResult };

export function ComparisonOverlayChart({ comparison }: Props) {
  const t = useTranslations('simulators.compare');
  const series = comparison.rows.map((row) => ({
    key: row.label,
    name: t('variant', { label: row.label }),
    points: row.result.paymentCurve,
  }));

  return <SeriesOverlayChart title={t('overlayTitle')} series={series} />;
}
