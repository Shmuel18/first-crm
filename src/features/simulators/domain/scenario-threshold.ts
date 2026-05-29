import type { CurvePoint } from '../types';

export function firstMonthAboveThreshold(
  curve: ReadonlyArray<CurvePoint>,
  threshold: number,
): number | null {
  return curve.find((point) => point.value > threshold)?.monthIndex ?? null;
}

