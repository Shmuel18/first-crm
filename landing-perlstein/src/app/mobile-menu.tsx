'use client';

import { useState } from 'react';
import { Menu, Phone, X } from 'lucide-react';

import styles from './perlstein-v2.module.css';

import type { ReactElement } from 'react';

const LINKS = [
  ['#why', 'למה יועץ?'],
  ['#solutions', 'פתרונות'],
  ['#process', 'התהליך'],
  ['#about', 'אודות'],
  ['#questions', 'שאלות'],
] as const;

export default function MobileMenu(): ReactElement {
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);
  return <div className={styles.mobileMenu}>
    <button type="button" aria-expanded={open} aria-controls="perlstein-mobile-nav" aria-label={open ? 'סגירת תפריט' : 'פתיחת תפריט'} onClick={() => setOpen((value) => !value)}>
      {open ? <X size={22} /> : <Menu size={22} />}
    </button>
    {open && <nav id="perlstein-mobile-nav" className={styles.mobileNav} aria-label="ניווט למקטעי הדף">
      {LINKS.map(([href, label]) => <a key={href} href={href} onClick={close}>{label}</a>)}
      <a className={styles.mobileNavPhone} href="tel:0533140442" onClick={close}><Phone size={16} /> 053-314-0442</a>
    </nav>}
  </div>;
}
