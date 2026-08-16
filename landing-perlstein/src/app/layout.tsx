import { Frank_Ruhl_Libre, Heebo } from 'next/font/google';

import './globals.css';

import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';

const heebo = Heebo({
  variable: '--font-heebo',
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: '--font-frank-ruhl',
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'פרלשטיין משכנתאות | תכנון נכון. החלטה בטוחה.',
  description: 'ייעוץ וליווי אישי למשכנתאות, מחזור משכנתא ומימון נדל״ן — מהתמונה הראשונית ועד לביצוע.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frankRuhl.variable}`}>
      <body>{children}</body>
    </html>
  );
}
