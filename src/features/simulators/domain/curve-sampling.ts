import type { CurvePoint } from '../types';

export interface YearlyCurvePoint {
  year: number;
  value: number;
}

export function sampleAnnualCurve(curve: ReadonlyArray<CurvePoint>): ReadonlyArray<YearlyCurvePoint> {
  return curve
    .filter((point) => point.monthIndex % 12 === 0 || point.monthIndex === curve.length)
    .map((point) => ({ year: Math.ceil(point.monthIndex / 12), value: point.value }));
}

