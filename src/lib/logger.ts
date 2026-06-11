/**
 * Structured JSON logger. Writes to stdout/stderr so Vercel captures it
 * naturally — pipe through Vercel Log Drains → Better Stack / Datadog /
 * Sentry to get queryable history.
 *
 * Design choices:
 * - One JSON object per line (Vercel + most log aggregators parse this
 *   natively).
 * - No async + no I/O beyond `console.*` so it's safe to call from any
 *   layer including hot paths.
 * - Includes `time` (ISO) + `level`; everything else is caller-supplied
 *   structured fields.
 *
 * Migrating from `console.error('msg', err)` to `logger.error('msg', { err })`
 * is the goal. The bare `console.*` calls scattered across the codebase
 * continue to work — Vercel captures them — they just lose structure.
 *
 * NOTE on PII: never put raw `err` objects in fields if they may contain
 * Supabase row data. Prefer `{ code: err.code, message: err.message }`.
 * As defense-in-depth, every field value is additionally run through the
 * same scrubber Sentry uses (emails, IL national IDs, phones, tokens,
 * password-bearing keys) before the line is emitted — caller discipline is
 * the first line, the scrubber is the backstop.
 */
import { scrubDeep } from '@/lib/sentry/pii-scrub';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Lower threshold in dev so debug() shows; quiet in prod by default.
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;

  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    message,
  };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      entry[k] = scrubDeep(v);
    }
  }

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Circular / non-serializable field — fall back to a safe shape so the
    // log line still lands somewhere.
    line = JSON.stringify({ level, time: entry.time, message, _logError: 'unserializable_fields' });
  }

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
