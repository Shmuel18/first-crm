'use client';

import { Accessibility, Eye, Link2, Minus, Plus, RotateCcw, X, ZapOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from '../perlstein-landing.module.css';

type Preferences = { scale: number; contrast: boolean; links: boolean; reduceMotion: boolean };
const initial: Preferences = { scale: 100, contrast: false, links: false, reduceMotion: false };

export default function AccessibilityTools() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(initial);
  useEffect(() => { const root = document.documentElement; root.style.setProperty('--perlstein-font-scale', `${prefs.scale / 100}`); root.toggleAttribute('data-perlstein-contrast', prefs.contrast); root.toggleAttribute('data-perlstein-links', prefs.links); root.toggleAttribute('data-perlstein-reduce-motion', prefs.reduceMotion); return () => { root.style.removeProperty('--perlstein-font-scale'); root.removeAttribute('data-perlstein-contrast'); root.removeAttribute('data-perlstein-links'); root.removeAttribute('data-perlstein-reduce-motion'); }; }, [prefs]);
  const update = (next: Partial<Preferences>) => setPrefs((current) => ({ ...current, ...next }));
  return <div className={styles.accessibilityWidget}><button type="button" className={styles.accessibilityToggle} aria-expanded={open} aria-controls="accessibility-panel" aria-label={open ? 'סגירת תפריט נגישות' : 'פתיחת תפריט נגישות'} onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true" /> : <Accessibility aria-hidden="true" />}<span>נגישות</span></button>{open && <section id="accessibility-panel" className={styles.accessibilityPanel} aria-label="התאמות נגישות"><div className={styles.accessibilityTitle}><Accessibility size={22} aria-hidden="true" /><div><strong>התאמות נגישות</strong><small>בחרו את התצוגה הנוחה לכם</small></div></div><div className={styles.fontControls}><span>גודל טקסט</span><div><button type="button" aria-label="הקטנת טקסט" onClick={() => update({ scale: Math.max(90, prefs.scale - 10) })}><Minus aria-hidden="true" /></button><output aria-live="polite">{prefs.scale}%</output><button type="button" aria-label="הגדלת טקסט" onClick={() => update({ scale: Math.min(130, prefs.scale + 10) })}><Plus aria-hidden="true" /></button></div></div><button type="button" aria-pressed={prefs.contrast} onClick={() => update({ contrast: !prefs.contrast })}><Eye aria-hidden="true" /> ניגודיות גבוהה</button><button type="button" aria-pressed={prefs.links} onClick={() => update({ links: !prefs.links })}><Link2 aria-hidden="true" /> הדגשת קישורים</button><button type="button" aria-pressed={prefs.reduceMotion} onClick={() => update({ reduceMotion: !prefs.reduceMotion })}><ZapOff aria-hidden="true" /> עצירת אנימציות</button><button type="button" className={styles.resetAccessibility} onClick={() => setPrefs(initial)}><RotateCcw aria-hidden="true" /> איפוס התאמות</button><a href="/perlstein/accessibility">להצהרת הנגישות המלאה</a></section>}</div>;
}
