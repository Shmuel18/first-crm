'use client';

import type { RiskLevel } from '../types';

type Props = { level: RiskLevel; valuePct: number };

const NEEDLE_COLOR: Record<RiskLevel, string> = {
  low: '#1D9E75',
  medium: '#EF9F27',
  high: '#E24B4A',
};

/**
 * Compact half-circle risk meter for the dark KPI strip. Pure presentation: the
 * needle angle reflects valuePct (0% = far left / green, 100% = far right / red).
 * Decorative — the tile already carries a text label + value for screen readers.
 */
export function RiskGauge({ level, valuePct }: Props) {
  const clamped = Math.min(100, Math.max(0, valuePct));
  const angle = (1 - clamped / 100) * Math.PI;
  const x = (40 + 26 * Math.cos(angle)).toFixed(1);
  const y = (38 - 26 * Math.sin(angle)).toFixed(1);
  return (
    <svg viewBox="0 0 80 44" className="h-9 w-16 shrink-0" aria-hidden="true">
      <path d="M10,38 A30,30 0 0 1 26,12" fill="none" stroke="#1D9E75" strokeWidth="6" strokeLinecap="round" />
      <path d="M28,11 A30,30 0 0 1 52,11" fill="none" stroke="#EF9F27" strokeWidth="6" strokeLinecap="round" />
      <path d="M54,12 A30,30 0 0 1 70,38" fill="none" stroke="#E24B4A" strokeWidth="6" strokeLinecap="round" />
      <line x1="40" y1="38" x2={x} y2={y} stroke={NEEDLE_COLOR[level]} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="38" r="3" fill={NEEDLE_COLOR[level]} />
    </svg>
  );
}
