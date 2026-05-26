/**
 * Default deadline for outbound HTTP calls (Drive, Google OAuth, Resend).
 * Calibrated so a Vercel function with a 60s budget can survive a couple of
 * retries before the platform kills it.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

/**
 * Returns an AbortSignal that fires after `ms`. Wraps AbortSignal.timeout
 * (Node 18+, supported on all runtimes the app targets). When the signal
 * fires, fetch() rejects with `AbortError`, which the caller should classify
 * as a transient/timeout failure (not a permanent error).
 */
export function timeoutSignal(ms: number = DEFAULT_FETCH_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Wraps an arbitrary promise with a hard deadline. Used when the underlying
 * client doesn't expose an AbortSignal hook (e.g., the Resend SDK). Rejects
 * with the given reason after `ms`. The wrapped promise keeps running in
 * the background — there's no way to cancel it without cooperation — but
 * the caller's await unblocks.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_FETCH_TIMEOUT_MS,
  reason: string = 'timeout',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(reason)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
