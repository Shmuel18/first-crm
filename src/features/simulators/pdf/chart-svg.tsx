import { Line, Polyline, Rect, Svg, Text, View } from '@react-pdf/renderer';

import { COLOR_LINE, COLOR_LINE_DARK } from './report-styles';

/**
 * react-pdf renderer for a payment/balance curve — the second renderer of the
 * engine's curve data (recharts is the on-screen one; see the plan). The Svg
 * holds geometry only; every label is a normal <Text> so Hebrew/RTL glyphs go
 * through the registered Heebo font rather than risky SVG text shaping.
 */
type ChartPoint = { year: number; value: number };

type Props = {
  points: ReadonlyArray<ChartPoint>;
  color: string;
  caption: string;
};

const W = 520;
const H = 130;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

export function ReportChart({ points, color, caption }: Props) {
  const polyline = buildPolyline(points);

  return (
    <View style={{ marginTop: 4 }}>
      <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 130 }}>
        <Rect x={0} y={0} width={W} height={H} fill="#FFFFFF" stroke={COLOR_LINE} strokeWidth={0.5} />
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * frac;
          return <Line key={frac} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke={COLOR_LINE} strokeWidth={0.5} />;
        })}
        <Line x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM} stroke={COLOR_LINE_DARK} strokeWidth={1} />
        {polyline ? <Polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} /> : null}
      </Svg>
      <Text style={{ fontSize: 8, color: '#525252', textAlign: 'center', marginTop: 2 }}>{caption}</Text>
    </View>
  );
}

function buildPolyline(points: ReadonlyArray<ChartPoint>): string | null {
  if (points.length < 2) return null;
  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const step = innerW / (points.length - 1);
  return points
    .map((p, i) => {
      const x = PAD_X + i * step;
      const y = PAD_TOP + innerH * (1 - p.value / maxValue);
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
