/**
 * Sentry init for the browser runtime. Loaded automatically by
 * @sentry/nextjs when next.config.ts is wrapped in withSentryConfig.
 *
 * Uses NEXT_PUBLIC_SENTRY_DSN (mirror of the server DSN). The PII scrubber
 * runs here too — browser-side errors can carry filled-in form values that
 * we never want shipped to Sentry as-is.
 */
import * as Sentry from '@sentry/nextjs';

import { env } from '@/lib/env';
import { sentryBeforeSend } from '@/lib/sentry/pii-scrub';

if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Browser-only: capture interaction breadcrumbs (clicks, network requests)
    // so a thrown error in production has the click trail that led to it.
    // The scrubber strips PII from breadcrumb data before send.
    integrations: [Sentry.browserTracingIntegration()],
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
  });
}
