type TimingMeta = Record<string, boolean | number | string | null | undefined>;

const isEnabled = process.env.PERF_LOGS === '1' || process.env.PERF_LOGS === 'true';
const defaultThresholdMs = Number(process.env.PERF_LOG_THRESHOLD_MS ?? 250);

function cleanMeta(meta: TimingMeta): TimingMeta {
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  ) as TimingMeta;
}

export async function timeAsync<T>(
  label: string,
  fn: () => Promise<T>,
  meta: TimingMeta = {},
): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - t0);
    if (isEnabled && ms >= defaultThresholdMs) {
      console.info('[perf]', { label, ms, ...cleanMeta(meta) });
    }
  }
}
