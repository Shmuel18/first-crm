'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for crashes in the root layout itself. It renders its
 * own <html>/<body> because it replaces the root layout, and therefore lives
 * OUTSIDE NextIntlClientProvider + globals.css — so the copy is static and the
 * styles are inline (Hebrew-primary, brand colors).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          background: '#FAFAFA',
          color: '#0A0A0A',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
          משהו השתבש · Something went wrong
        </h1>
        <p style={{ color: '#525252', margin: 0, fontSize: '0.9rem' }}>
          אירעה שגיאה בלתי צפויה. אפשר לנסות שוב. · An unexpected error occurred. You can try again.
        </p>
        {error.digest && (
          <p style={{ color: '#737373', margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
            ID: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#C9A961',
            color: '#0A0A0A',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          נסה שוב · Try again
        </button>
      </body>
    </html>
  );
}
