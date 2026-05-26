/**
 * Sentry init for the Node.js server runtime (Server Components, Server
 * Actions, Route Handlers, Vercel cron). Loaded by instrumentation.ts.
 *
 * Init is gated on SENTRY_DSN being set — when it isn't (dev, fresh
 * deploys without an account) the SDK noops cleanly with zero overhead.
 */
import * as Sentry from '@sentry/nextjs';

import { env } from '@/lib/env';
import { sentryBeforeSend } from '@/lib/sentry/pii-scrub';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    // 10 % sampling for traces — Pricing tier on a free Sentry account
    // covers ~5K transactions/month. Dial up once you upgrade.
    tracesSampleRate: 0.1,
    // Profile every traced transaction — cheap once tracing is sampled.
    profilesSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
  });
}
