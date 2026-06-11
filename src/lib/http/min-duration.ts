/**
 * Sleep until at least `minMs` have elapsed since `startedAtMs` (Date.now()).
 *
 * Used to equalize response timing on enumeration-sensitive paths: when a
 * handler's work differs between "account exists" and "account doesn't"
 * (e.g. password reset), padding every exit to a shared floor makes the
 * branches indistinguishable by latency as long as the real work stays
 * under the floor.
 */
export async function padToMinDuration(startedAtMs: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAtMs);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
