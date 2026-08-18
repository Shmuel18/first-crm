/**
 * First-render size for every Recharts <ResponsiveContainer>.
 *
 * Recharts defaults its container state to `{ width: -1, height: -1 }` and only
 * measures the real box in an effect. Its size check runs during that first
 * render, so a percentage-sized container always logs
 * "The width(-1) and height(-1) of chart should be greater than 0" — in
 * production too, since recharts hardcodes `isDev = true` in its logger.
 *
 * Handing it positive numbers up front skips the bogus warning and renders the
 * first frame at a plausible size instead of a collapsed one; the effect
 * corrects it to the true size on the same tick. The numbers are a generic
 * placeholder, not a layout contract — each chart's real height comes from its
 * wrapper's Tailwind height class.
 *
 * NOTE: `minWidth`/`minHeight` do NOT fix this. They never reach the size
 * calculation (see recharts' responsiveContainerUtils) — they only appear in
 * the text of the warning, which is why they read like a fix and aren't one.
 */
export const CHART_INITIAL_DIMENSION = { width: 600, height: 240 } as const;
