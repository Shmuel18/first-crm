/**
 * Next.js instrumentation hook — runs once per server process at boot.
 *
 * Two responsibilities:
 *   1. Bump the EventEmitter listener cap on Node's process / stdout / stderr
 *      to work around a Next.js 16 + Turbopack dev-server listener leak that
 *      surfaces as "Jest worker encountered N child process exceptions" once
 *      the page tree gets dense. Node-only, loaded via dynamic import so the
 *      Edge runtime never compiles it.
 *   2. Init Sentry per runtime (server / edge). Skipped at module level
 *      when SENTRY_DSN is unset — see sentry.{server,edge}.config.ts.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// onRequestError is exported by @sentry/nextjs in v9+ but its name moved a few
// times across major versions. Re-export defensively so the hook works if the
// SDK is present and silently no-ops if it isn't. Next.js calls this when a
// rendering / Route Handler throws — Sentry wires it to capture the exception.
export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const mod = await import('@sentry/nextjs');
  if (typeof mod.captureRequestError === 'function') {
    mod.captureRequestError(...args);
  }
}
