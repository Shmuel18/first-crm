import type { Metadata, Viewport } from 'next';
import { Frank_Ruhl_Libre, Heebo, Inter } from 'next/font/google';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { getDirection, parseLocale } from '@/lib/i18n/direction';

import './globals.css';

const heebo = Heebo({
  variable: '--font-heebo',
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: '--font-frank-ruhl',
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: 'Kaufman Finance Group',
    template: '%s · Kaufman Finance Group',
  },
  description: 'מערכת ניהול תיקי משכנתא',
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = parseLocale(await getLocale());
  const messages = await getMessages();
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} ${inter.variable} ${frankRuhl.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {/* Polyfill crypto.randomUUID for INSECURE (HTTP) contexts. The browser
            only exposes crypto.randomUUID over HTTPS/localhost; the demo runs on
            plain HTTP, so any call (ours or a library's) would otherwise throw
            "crypto.randomUUID is not a function" and crash the view. Runs before
            hydration. (Proper long-term fix: serve over HTTPS.) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var c=globalThis.crypto;if(c&&typeof c.randomUUID!=="function"&&typeof c.getRandomValues==="function"){c.randomUUID=function(){var b=c.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;for(var s="",i=0;i<16;i++){s+=(b[i]+256).toString(16).slice(1);if(i===3||i===5||i===7||i===9)s+="-";}return s;};}}catch(e){}})();',
          }}
        />
        <NuqsAdapter>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
