/**
 * Sentry init for the BROWSER runtime.
 *
 * Next.js 16 auto-loads `instrumentation-client.ts` on the client at startup.
 * This is what was missing (SRE-1): the client init previously lived in
 * `sentry.client.config.ts`, which is ONLY bundled when next.config is wrapped
 * in `withSentryConfig`. It wasn't — so the browser SDK never initialized and
 * front-end errors (including the `Sentry.captureException` calls in the route
 * error boundaries) were silently dropped. Living here, the init loads without
 * needing `withSentryConfig`.
 *
 * Uses NEXT_PUBLIC_SENTRY_DSN; PII is scrubbed before send — browser errors can
 * carry filled-in form values we never want shipped to Sentry as-is.
 *
 * NOTE: source-map upload (so production stack traces are readable) still needs
 * `withSentryConfig` + a SENTRY_AUTH_TOKEN build secret — tracked as a separate
 * follow-up (Turbopack/Next-16 build-plugin compatibility to verify first).
 */
import * as Sentry from '@sentry/nextjs';

import { env } from '@/lib/env';
import { sentryBeforeSend } from '@/lib/sentry/pii-scrub';

if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Interaction breadcrumbs (clicks, fetches) so a production error carries the
    // trail that led to it. The scrubber strips PII from breadcrumb data on send.
    integrations: [Sentry.browserTracingIntegration()],
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
  });
}

// App Router navigation instrumentation (Sentry v8+). Next.js calls this on
// client-side route changes; harmless no-op if the SDK didn't init (DSN unset).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
