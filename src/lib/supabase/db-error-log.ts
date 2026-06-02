/**
 * Reduce a Supabase / Postgres error to the fields that are SAFE to write to
 * server logs.
 *
 * `details` and `hint` are dropped on purpose: Postgres puts row VALUES in
 * them. A unique violation's detail is
 *   `Key (national_id)=(123456789) already exists.`
 * and a check / not-null violation's detail is
 *   `Failing row contains (<every column of the row>)`.
 * Logging either leaks PII (national IDs, phones, emails, financials) into
 * server logs and Sentry — see release-review finding PRIV-2.
 *
 * `code` (the SQLSTATE) and `message` (constraint / relation name) carry no row
 * data and are kept for debugging. This is verified for our RPCs: none `RAISE`
 * a row value into the message text, so `message` never contains a national_id.
 *
 * Storage / Auth errors lack `details`/`hint` entirely, so passing them through
 * here is a harmless no-op that still yields the safe `{ code, message }` shape.
 *
 * Usage: `console.error('[tag] what failed', safeDbError(error))`.
 * Do NOT use this for caught exceptions (`catch (err)`) — those are Error
 * objects whose stack you want; log them directly.
 */
export function safeDbError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): { code: string | null; message: string | null } {
  return { code: error?.code ?? null, message: error?.message ?? null };
}
