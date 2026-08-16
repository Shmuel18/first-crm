import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Banknote, Building2, CheckCircle2, ClipboardCheck, FileCheck2, Handshake, Landmark, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, Target } from 'lucide-react';

import styles from '../perlstein-landing.module.css';

export const metadata: Metadata = {
  title: 'פרלשטיין משכנתאות | הדרך הבטוחה למשכנתא נכונה',
  description: 'ליווי מקצועי ואישי למשכנתאות, מחזור משכנתא והשקעות נדל״ן. מתחילים בשאלון קצר ומקבלים תמונת מצב ברורה.',
  openGraph: { title: 'פרלשטיין משכנתאות', description: 'משכנתא טובה מתחילה בתכנון נכון ובליווי שמסתכל על כל התמונה.', type: 'website', locale: 'he_IL' },
  twitter: { card: 'summary', title: 'פרלשטיין משכנתאות', description: 'מתכננים נכון. מתקדמים בביטחון.' },
};

const services = [
  { icon: Landmark, title: 'משכנתא לרכישת נכס', text: 'בניית תמהיל מדויק, בחירת הבנק הנכון וניהול המו״מ עד לביצוע.' },
  { icon: Banknote, title: 'מחזור משכנתא', text: 'בדיקה יסודית של ההלוואה הקיימת ואיתור הזדמנויות לחיסכון אמיתי.' },
  { icon: Building2, title: 'השקעות נדל״ן', text: 'תכנון מימון חכם למשקיעים, מתוך הסתכלות רחבה על העסקה והתזרים.' },
  { icon: Handshake, title: 'תיקים מורכבים', text: 'פתרונות יצירתיים לעצמאים, הכנסות מורכבות ועסקאות שדורשות ניסיון.' },
];
const process = [
  ['01', 'ממלאים שאלון קצר', 'כמה דקות שמאפשרות לנו להבין את התמונה עוד לפני השיחה.'],
  ['02', 'ממפים את האפשרויות', 'עוברים על הנתונים, היעדים והאתגרים ובונים אסטרטגיה.'],
  ['03', 'מנהלים את הבנקים', 'הגשות, מו״מ, שמאות, בטחונות וכל מה שבדרך.'],
  ['04', 'מתקדמים לביצוע', 'מלווים אתכם עד שהכסף עובר והעסקה מושלמת.'],
];

export default function PerlsteinLandingPage() {
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/perlstein" className={styles.logoLink} aria-label="פרלשטיין משכנתאות — דף הבית"><Image src="/brands/perlstein/logo-on-dark.png" alt="פרלשטיין משכנתאות" width={245} height={76} className={styles.logo} priority /></Link>
      <nav className={styles.nav} aria-label="ניווט ראשי"><a href="#services">השירותים שלנו</a><a href="#process">איך זה עובד</a><a href="#about">מי אנחנו</a></nav>
      <div className={styles.headerActions}><a href="https://wa.me/972533140442" className={styles.loginLink}><MessageCircle size={16} /> דברו איתנו</a><Link href="/check" className={styles.headerCta}>מתחילים כאן</Link></div>
    </div></header>

    <section className={styles.hero}><div className={styles.heroGlow} aria-hidden="true" /><div className={styles.heroInner}>
      <div className={styles.heroCopy}><div className={styles.eyebrow}><Sparkles size={17} /> ייעוץ משכנתאות • אסטרטגיית מימון • ליווי אישי</div>
        <h1>לא לוקחים משכנתא.<span>מתכננים עתיד.</span></h1>
        <p className={styles.heroLead}>החלטה של שנים צריכה יותר מהצעת ריבית. היא צריכה אדם שמבין את כל התמונה, בונה אסטרטגיה מדויקת ומנהל עבורכם את הדרך עד לביצוע.</p>
        <div className={styles.heroActions}><Link href="/check" className={styles.primaryCta}>לשאלון ההתאמה האישי <ArrowLeft size={20} /></Link><a href="tel:0533140442" className={styles.secondaryCta}><Phone size={18} /> 053-314-0442</a></div>
        <div className={styles.heroAssurance}><span><CheckCircle2 size={16} /> ללא התחייבות</span><span><CheckCircle2 size={16} /> מענה אישי</span><span><CheckCircle2 size={16} /> הנתונים נשמרים בצורה מאובטחת</span></div>
      </div>
      <div className={styles.heroVisual}><div className={styles.archFrame}><div className={styles.portraitWrap}><Image src="/brands/perlstein/portrait-ai.png" alt="מנחם פרלשטיין, יועץ משכנתאות" fill sizes="(max-width: 900px) 76vw, 410px" className={styles.portrait} priority /></div><div className={styles.nameCard}><span>מנחם פרלשטיין</span><small>ייעוץ משכנתאות והשקעות נדל״ן</small></div></div>
        <div className={`${styles.floatingCard} ${styles.cardTop}`}><ShieldCheck size={24} /><span><strong>ליווי מקצה לקצה</strong><small>לא משאירים אתכם לבד מול הבנק</small></span></div>
        <div className={`${styles.floatingCard} ${styles.cardBottom}`}><Target size={24} /><span><strong>תכנון לפי היעדים שלכם</strong><small>לא לפי תבנית קבועה</small></span></div>
      </div>
    </div><div className={styles.heroStats}><div><strong>01 · אבחון</strong><span>מבינים את כל התמונה לפני שמתקדמים</span></div><div><strong>02 · אסטרטגיה</strong><span>בונים מהלך שמתאים לחיים שלכם</span></div><div><strong>03 · ביצוע</strong><span>מנהלים את הבנקים, המסמכים והדרך</span></div></div></section>

    <section className={styles.intro}><div className={styles.sectionKicker}>לא רק ריבית</div><h2>משכנתא טובה מתחילה בהבנת התמונה כולה</h2><p>המשפחה, ההכנסות, הנכסים, התוכניות לעתיד והעסקה עצמה — הכול מתחבר. אנחנו מסתכלים רחוק, מתכננים חכם ומנהלים כל שלב כדי שתוכלו להתקדם בביטחון.</p>
      <div className={styles.valueGrid}><article><FileCheck2 /><h3>סדר ובהירות</h3><p>יודעים בכל רגע איפה התיק עומד ומה הצעד הבא.</p></article><article><ShieldCheck /><h3>אחריות מלאה</h3><p>ליווי אישי מול הבנקים וכל בעלי המקצוע עד לסיום.</p></article><article><Target /><h3>דיוק בהחלטות</h3><p>בונים פתרון שמשרת את המטרות שלכם גם בעוד שנים.</p></article></div>
    </section>

    <section id="services" className={styles.services}><div className={styles.sectionHeading}><div><span className={styles.sectionKicker}>המומחיות שלנו</span><h2>פתרונות מימון שמתאימים לעסקה שלכם</h2></div><p>כל תיק מתחיל בהקשבה וממשיך בעבודה מדויקת מול הגורמים הנכונים.</p></div>
      <div className={styles.serviceGrid}>{services.map(({ icon: Icon, title, text }, index) => <article key={title} className={styles.serviceCard}><span className={styles.serviceNumber}>0{index + 1}</span><Icon size={30} /><h3>{title}</h3><p>{text}</p><Link href="/check">בדיקת התאמה <ArrowLeft size={16} /></Link></article>)}</div>
    </section>

    <section id="process" className={styles.process}><div className={styles.processCopy}><span className={styles.sectionKicker}>מהצעד הראשון ועד המפתח</span><h2>תהליך מסודר שמחזיר לכם את השקט</h2><p>אנחנו מרכזים את התהליך, עוקבים אחרי כל משימה ומעדכנים אתכם לאורך הדרך.</p><Link href="/check" className={styles.textCta}>בואו נתחיל <ArrowLeft size={18} /></Link></div>
      <div className={styles.steps}>{process.map(([number, title, text]) => <article key={number} className={styles.step}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </section>

    <section className={styles.digital}><div className={styles.digitalPanel}><div className={styles.digitalCopy}><span className={styles.sectionKicker}>שירות מתקדם, אנושי ופשוט</span><h2>מתחילים מהבית. ממשיכים ביחד.</h2><p>השאלון הדיגיטלי מרכז את המידע הראשוני ומאפשר לנו להגיע לשיחה מוכנים — כדי לחסוך לכם זמן ולהתחיל ישר מהעיקר.</p>
      <ul><li><ClipboardCheck /> שאלון קצר וברור</li><li><ShieldCheck /> שמירה מאובטחת של הפרטים</li><li><MessageCircle /> חזרה אישית לאחר בדיקת הנתונים</li></ul><Link href="/check" className={styles.primaryCta}>למילוי השאלון <ArrowLeft size={20} /></Link></div>
      <div className={styles.formMockup} aria-label="המחשה של שאלון ההתאמה"><div className={styles.mockupTop}><Image src="/brands/perlstein/mark.png" alt="" width={44} height={44} /><span>שאלון התאמה אישי</span><small>שלב 1 מתוך 4</small></div><div className={styles.progress}><span /></div><div className={styles.mockupBody}><span className={styles.fakeLabel}>מה מטרת המשכנתא?</span><div className={styles.fakeChoices}><b>רכישת נכס</b><b>מחזור משכנתא</b><b>השקעה</b><b>מטרה אחרת</b></div><span className={styles.fakeLabel}>כמה מימון נדרש?</span><div className={styles.fakeInput}>₪</div><div className={styles.fakeButton}>המשך</div></div></div>
    </div></section>

    <section id="about" className={styles.about}><div className={styles.aboutImage}><Image src="/brands/perlstein/portrait-ai.png" alt="מנחם פרלשטיין" fill sizes="(max-width: 800px) 90vw, 430px" className={styles.aboutPortrait} /></div><div className={styles.aboutCopy}><span className={styles.sectionKicker}>מילה אישית</span><h2>יש לכם כתובת אחת לכל הדרך</h2><p className={styles.quote}>“המטרה שלי היא לא רק להשיג אישור — אלא לבנות עבורכם דרך נכונה, להסביר כל החלטה ולנהל את התהליך כאילו העסקה היא שלי.”</p><p>בפרלשטיין משכנתאות כל תיק מקבל חשיבה, ירידה לפרטים וליווי אישי. אנחנו משלבים היכרות עמוקה עם עולם הבנקאות והנדל״ן עם שירות זמין, מסודר וברור.</p><div className={styles.signature}><strong>מנחם פרלשטיין</strong><span>יועץ משכנתאות והשקעות נדל״ן</span></div></div></section>

    <section className={styles.finalCta}><div><span className={styles.sectionKicker}>הצעד הראשון פשוט</span><h2>בואו נבדוק מה נכון עבורכם</h2><p>מלאו את השאלון הקצר ונחזור אליכם עם תמונת מצב ראשונית וכיוון ברור להמשך.</p></div><div className={styles.finalActions}><Link href="/check" className={styles.lightCta}>לשאלון ההתאמה <ArrowLeft size={20} /></Link><a href="https://wa.me/972533140442" className={styles.whatsappCta}><MessageCircle size={19} /> WhatsApp</a></div></section>

    <footer className={styles.footer}><div className={styles.footerTop}><Image src="/brands/perlstein/logo-on-dark.png" alt="פרלשטיין משכנתאות" width={230} height={72} className={styles.footerLogo} /><p>ייעוץ משכנתאות והשקעות נדל״ן — תכנון מדויק, ליווי אישי וניהול מלא עד לביצוע.</p><div className={styles.contactList}><a href="tel:0533140442"><Phone size={17} /> 053-314-0442</a><a href="mailto:M33140442@gmail.com"><Mail size={17} /> M33140442@gmail.com</a><span><MapPin size={17} /> פנינת חמד, שמגר 21, ירושלים</span></div></div><div className={styles.footerBottom}><span>© 2026 פרלשטיין משכנתאות. כל הזכויות שמורות.</span><div><Link href="/check">שאלון לקוח</Link><a href="https://wa.me/972533140442">WhatsApp</a></div></div></footer>
  </main>;
}
