import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Banknote, Check, CheckCircle2, ClipboardCheck, FileSearch, Landmark, Mail, MapPin, MessageCircle, Phone, Scale, ShieldCheck, Sparkles, UserRoundCheck, X } from 'lucide-react';

import styles from './perlstein-v2.module.css';
import AccessibilityTools from './accessibility-tools';
import GoalSelector from './goal-selector';

export const metadata: Metadata = {
  title: 'פרלשטיין משכנתאות | תכנון נכון. החלטה בטוחה.',
  description: 'ייעוץ וליווי אישי למשכנתאות, מחזור משכנתא ומימון נדל״ן — מהתמונה הראשונית ועד לביצוע.',
};

const outcomes = [
  { icon: FileSearch, title: 'רואים את כל התמונה', text: 'הון עצמי, החזר חודשי, תזרים ותוכניות לעתיד מתחברים לתוכנית אחת ברורה.' },
  { icon: Scale, title: 'משווים נכון', text: 'לא מסתפקים בכותרת של ריבית. בודקים את מבנה ההלוואה, הסיכונים והעלות לאורך הדרך.' },
  { icon: Landmark, title: 'מנהלים את הבנקים', text: 'מרכזים את ההגשות, ההשוואה והמשא ומתן — כדי שאתם לא תצטרכו לרדוף אחרי התהליך.' },
];

const process = [
  ['01', 'מספרים לנו מה אתם מתכננים', 'שאלון קצר נותן לנו תמונת פתיחה מסודרת עוד לפני השיחה.'],
  ['02', 'בונים אסטרטגיית מימון', 'ממפים יכולת החזר, הון עצמי, צרכים והחלטות שצריך לקבל.'],
  ['03', 'יוצאים לבנקים', 'מנהלים הגשות, השוואות ומשא ומתן בצורה מרוכזת ושקופה.'],
  ['04', 'מלווים עד לביצוע', 'עוקבים אחרי המסמכים והמשימות עד שהמהלך הושלם.'],
];

export default function PerlsteinLandingPage() {
  return <main className={styles.page}>
    <a className={styles.skipLink} href="#content">דילוג לתוכן המרכזי</a>
    <div className={styles.topline}>ייעוץ אישי • תכנון מדויק • דרך ברורה מול הבנקים</div>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/perlstein" aria-label="פרלשטיין משכנתאות — דף הבית"><Image src="/brands/perlstein/logo-on-dark.png" alt="פרלשטיין משכנתאות" width={218} height={68} className={styles.logo} priority /></Link>
      <nav className={styles.nav} aria-label="ניווט ראשי"><a href="#why">למה יועץ?</a><a href="#solutions">פתרונות</a><a href="#process">התהליך</a><a href="#about">מנחם פרלשטיין</a><a href="#questions">שאלות</a></nav>
      <a className={styles.headerCta} href="tel:0533140442"><Phone size={16} /> 053-314-0442</a>
    </div></header>

    <section id="content" tabIndex={-1} className={styles.hero}><div className={styles.heroInner}>
      <div className={styles.heroCopy}><span className={styles.eyebrow}><Sparkles size={16} /> ליווי אישי, מקצועי וברור</span>
        <h1>המשכנתא הנכונה מתחילה הרבה לפני <em>הריבית.</em></h1>
        <p>לפני שמתחייבים לשנים, בונים תמונה מלאה: כמה נכון לקחת, איך נכון להחזיר ומה ישאיר לכם אוויר גם בהמשך.</p>
        <div className={styles.actions}><Link className={styles.primary} href="/check">לשאלון ההתאמה <ArrowLeft size={19} /></Link><a className={styles.secondary} href="https://wa.me/972533140442"><MessageCircle size={18} /> שיחה ב־WhatsApp</a></div>
        <div className={styles.microProof}><span><CheckCircle2 /> ללא התחייבות</span><span><CheckCircle2 /> מענה אישי</span><span><CheckCircle2 /> תהליך מסודר ושקוף</span></div>
      </div>
      <div className={styles.planCard} aria-label="המחשה של תמונת המימון"><div className={styles.planTop}><span>תמונת המימון שלכם</span><BadgeCheck size={23} /></div><p>שלוש נקודות שצריכות להתחבר לפני שפונים לבנק</p>
        <div className={styles.planRows}><div><span>יכולת החזר</span><b>מה באמת נוח לכם?</b><i>01</i></div><div><span>הון עצמי</span><b>כמה נכון להשאיר בצד?</b><i>02</i></div><div><span>תוכניות לעתיד</span><b>איך התמהיל יגיב לשינוי?</b><i>03</i></div></div>
        <div className={styles.planResult}><ShieldCheck /><div><b>לא הצעה מהמדף</b><span>תכנון שנבנה סביב החיים שלכם</span></div></div>
      </div>
    </div></section>

    <section className={styles.proofStrip} aria-label="עקרונות השירות"><div><UserRoundCheck /><b>ליווי אישי</b><span>כתובת אחת לאורך הדרך</span></div><div><Banknote /><b>חשיבה כלכלית</b><span>מעבר לריבית הבודדת</span></div><div><ClipboardCheck /><b>סדר ושליטה</b><span>יודעים מה הצעד הבא</span></div><div><ShieldCheck /><b>שקיפות</b><span>מבינים לפני שמחליטים</span></div></section>

    <section id="why" className={styles.comparison}><div className={styles.sectionIntro}><span>הבדל קטן בגישה. הבדל גדול בהחלטה.</span><h2>אפשר לגשת לבד לבנק.<br />אפשר להגיע מוכנים.</h2></div><div className={styles.compareGrid}>
      <article className={styles.without}><div className={styles.compareTitle}><X /><h3>לבד מול הבנק</h3></div><ul><li>משווים בעיקר את הריבית שמופיעה בכותרת</li><li>מקבלים החלטות מתוך לחץ של זמן</li><li>מתנהלים מול כמה גורמים בלי תמונה אחת</li><li>מגלים את המשמעות של המסלולים בהמשך</li></ul></article>
      <article className={styles.with}><div className={styles.compareTitle}><Check /><h3>עם פרלשטיין משכנתאות</h3></div><ul><li>מתחילים מהחיים שלכם ומהיכולת האמיתית</li><li>בונים אסטרטגיה לפני שפונים לבנקים</li><li>מנהלים השוואה ומשא ומתן מסודרים</li><li>מקבלים הסבר וליווי עד לביצוע</li></ul></article>
    </div></section>

    <section id="solutions" className={styles.outcomes}><div className={styles.sectionIntro}><span>לא רשימת שירותים. תוצאה.</span><h2>החלטה גדולה צריכה להרגיש ברורה</h2><p>המטרה היא לא רק לקבל אישור — אלא להבין את הדרך ולבחור בה בביטחון.</p></div><div className={styles.outcomeGrid}>{outcomes.map(({icon: Icon,title,text}, index)=><article key={title}><small>0{index+1}</small><Icon /><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <GoalSelector />

    <section id="about" className={styles.about}><div className={styles.aboutPhoto}><Image src="/brands/perlstein/portrait-ai.png" alt="מנחם פרלשטיין, יועץ משכנתאות" fill sizes="(max-width: 800px) 90vw, 440px" /></div><div className={styles.aboutCopy}><span>נעים להכיר</span><h2>מנחם פרלשטיין.<br />איתכם מול ההחלטה.</h2><p className={styles.leadQuote}>“המטרה שלי היא שתבינו כל החלטה, תרגישו בשליטה ותדעו שיש מי שמנהל איתכם את הדרך.”</p><p>בפרלשטיין משכנתאות כל תיק מתחיל בהקשבה. רק אחרי שמבינים את המשפחה, העסקה והתוכניות קדימה — מתכננים את המימון וניגשים לבנקים.</p><a href="tel:0533140442">לשיחה עם מנחם <ArrowLeft size={18} /></a></div></section>

    <section id="process" className={styles.process}><div className={styles.sectionIntro}><span>מהרעיון ועד לביצוע</span><h2>ארבעה צעדים. דרך אחת מסודרת.</h2></div><div className={styles.steps}>{process.map(([number,title,text])=><article key={number}><b>{number}</b><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

    <section className={styles.questionnaire}><div><span>הצעד הראשון לוקח כמה דקות</span><h2>מתחילים בשאלון קצר.<br />מגיעים לשיחה מוכנים.</h2><p>השאלון מרכז את הנתונים הראשוניים ועוזר לנו להבין במה להתמקד כבר מהשיחה הראשונה.</p><Link href="/check">למילוי שאלון הלקוח <ArrowLeft size={20} /></Link></div><div className={styles.questionCard}><Image src="/brands/perlstein/mark.png" alt="" width={48} height={48} /><span>שאלון התאמה אישי</span><div className={styles.progress}><i /></div><small>מטרת המשכנתא</small><b>רכישת נכס</b><small>השלב הבא</small><b>תמונת הכנסות והתחייבויות</b><em>התצוגה להמחשה בלבד</em></div></section>

    <section id="questions" className={styles.faq}><div className={styles.sectionIntro}><span>שאלות נפוצות</span><h2>כדאי לדעת לפני שמתחילים</h2></div><div className={styles.faqList}><details><summary>מתי כדאי לפנות לייעוץ?</summary><p>ככל שמקדימים, אפשר להבין את מסגרת התקציב והאפשרויות לפני שמתחייבים לעסקה.</p></details><details><summary>כבר יש לי הצעה מהבנק. עדיין כדאי לבדוק?</summary><p>כן. חשוב לבדוק לא רק את הריבית, אלא גם את מבנה המסלולים, הסיכונים וההתאמה לתוכניות שלכם.</p></details><details><summary>מה צריך להכין לשיחה הראשונה?</summary><p>מתחילים בשאלון קצר. לאחר בדיקתו תקבלו הכוונה מסודרת לגבי המסמכים הרלוונטיים.</p></details><details><summary>האם אתם מטפלים גם במחזור משכנתא?</summary><p>כן. בודקים את המשכנתא הקיימת, עלויות היציאה והחלופות כדי להבין אם יש מהלך נכון עבורכם.</p></details></div></section>

    <section className={styles.finalCta}><div><span>לפני שחותמים, בודקים.</span><h2>בואו נבנה את התמונה שלכם.</h2></div><div className={styles.actions}><Link className={styles.darkButton} href="/check">לשאלון ההתאמה <ArrowLeft /></Link><a className={styles.outlineButton} href="tel:0533140442"><Phone /> 053-314-0442</a></div></section>

    <a href="https://wa.me/972533140442" className={styles.floatingWhatsapp} aria-label="פתיחת שיחה ב־WhatsApp"><MessageCircle /><span>דברו איתנו</span></a>
    <footer className={styles.footer}><div><Image src="/brands/perlstein/logo-on-dark.png" alt="פרלשטיין משכנתאות" width={220} height={69} /><p>ייעוץ משכנתאות והשקעות נדל״ן — תכנון מדויק וליווי אישי עד לביצוע.</p></div><div className={styles.contacts}><a href="tel:0533140442"><Phone /> 053-314-0442</a><a href="mailto:M33140442@gmail.com"><Mail /> M33140442@gmail.com</a><span><MapPin /> פנינת חמד, שמגר 21, ירושלים</span></div><div className={styles.footerBottom}><span>© 2026 פרלשטיין משכנתאות</span><Link href="/perlstein/accessibility">הצהרת נגישות</Link></div></footer>
    <AccessibilityTools />
  </main>;
}
