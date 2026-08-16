'use client';

import Link from 'next/link';
import { ArrowLeft, Banknote, Building2, Home, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import styles from './perlstein-v2.module.css';

const goals = [
  { id: 'purchase', icon: Home, label: 'רכישת דירה', title: 'מתכננים רכישה בלי להשאיר מקום להפתעות', text: 'נבדוק הון עצמי, יכולת החזר ומבנה מימון — ונבנה מסלול שמאפשר להתקדם לעסקה בביטחון.' },
  { id: 'refinance', icon: RefreshCw, label: 'מחזור משכנתא', title: 'בודקים אם המשכנתא הקיימת עדיין עובדת בשבילכם', text: 'ננתח את המסלולים הקיימים, עלויות היציאה והחלופות כדי לזהות חיסכון אמיתי ולא רק כותרת יפה.' },
  { id: 'invest', icon: Building2, label: 'השקעת נדל״ן', title: 'מימון שמתוכנן כחלק מההשקעה', text: 'נחבר בין העסקה, התזרים והיעדים שלכם ונבנה אסטרטגיית מימון שמסתכלת על התמונה הרחבה.' },
  { id: 'complex', icon: Banknote, label: 'תיק מורכב', title: 'גם כשלא הכול נכנס לתבנית של הבנק', text: 'עצמאים, הכנסות מורכבות או עסקה לא שגרתית — מתחילים במיפוי יסודי ומחפשים את הדרך הנכונה.' },
];

export default function GoalSelector() {
  const [active, setActive] = useState(goals[0]!);
  return <section className={styles.goalSection} aria-labelledby="goal-title">
    <span aria-hidden="true" className={styles.ghostNum}>03</span>
    <div className={styles.goalHeading} data-reveal=""><span className={styles.sectionKicker}>בואו נדבר עליכם</span><h2 id="goal-title">מה המטרה שלכם עכשיו?</h2><p>בחרו את הנושא שמעסיק אתכם וקבלו את הצעד הראשון המתאים.</p></div>
    <div className={styles.goalLayout}><div className={styles.goalTabs} role="group" aria-label="בחירת מטרת הייעוץ">{goals.map((goal) => { const Icon = goal.icon; const selected = active.id === goal.id; return <button key={goal.id} type="button" aria-pressed={selected} className={selected ? styles.goalTabActive : styles.goalTab} onClick={() => setActive(goal)}><Icon size={22} aria-hidden="true" /><span>{goal.label}</span></button>; })}</div>
      <div className={styles.goalResult} aria-live="polite" key={active.id}><span className={styles.goalIndex}>פרלשטיין / {active.label}</span><h3>{active.title}</h3><p>{active.text}</p><Link href="/check?source=perlstein">לבדיקת התאמה אישית <ArrowLeft size={18} aria-hidden="true" /></Link></div>
    </div>
  </section>;
}
