import type { Metadata } from 'next';
import { Frank_Ruhl_Libre, Heebo, Inter } from 'next/font/google';

import { DEFAULT_LOCALE, getDirection } from '@/lib/i18n/direction';

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
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: '--font-frank-ruhl',
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kaufman Finance Group',
  description: 'מערכת ניהול תיקי משכנתא',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_LOCALE;
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} ${inter.variable} ${frankRuhl.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
