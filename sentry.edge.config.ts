/**
 * Sentry init for the Edge runtime (middleware / proxy, edge-runtime
 * pages like /login + /forgot-password). Smaller SDK surface than the
 * Node config — no profiling, no Node-only integrations.
 */
import * as Sentry from '@sentry/nextjs';

import { env } from '@/lib/env';
import { sentryBeforeSend } from '@/lib/sentry/pii-scrub';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
  });
}
