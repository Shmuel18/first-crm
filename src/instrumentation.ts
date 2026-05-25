/**
 * Next.js instrumentation hook — runs once per server process at boot.
 *
 * Bumps the EventEmitter listener cap on Node's process / stdout / stderr to
 * work around a Next.js 16 + Turbopack dev-server listener leak that surfaces
 * as "Jest worker encountered N child process exceptions, exceeding retry
 * limit" once the page tree gets dense (~8+ server components per route).
 *
 * The Node-only code lives in `instrumentation-node.ts` and is loaded via
 * dynamic import so the Edge runtime never compiles it (it would warn about
 * `process.stdout` not being available — and those warnings themselves write
 * to stderr, feeding the very leak we're trying to plug).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await import('./instrumentation-node');
}
