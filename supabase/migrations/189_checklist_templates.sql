-- =============================================================================
-- Migration 189: editable preset checklist templates (F13)
-- =============================================================================
-- Kaufman's "ready lists" (the "רשימה מוכנה" picker) were hardcoded in
-- checklist-templates.ts — only a dev could change them. This moves them to a
-- DB table the manager edits from /settings/checklists. Items are a JSONB array
-- of label strings (matches the constant's shape; no separate items table).
--
-- Staff read (the picker is used by every advisor); admin write (is_admin).
-- Seeded with the 12 office work-lists; is_system marks the factory defaults.
-- Dependencies: 002 (is_admin), 143 (schema_version).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  TEXT UNIQUE,
  group_key     TEXT NOT NULL DEFAULT 'process'
                  CHECK (group_key IN ('identity', 'income', 'process')),
  name_he       TEXT NOT NULL,
  name_en       TEXT NOT NULL DEFAULT '',
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_active
  ON public.checklist_templates(sort_order)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- SELECT — any authenticated staff (the picker reads it for every advisor).
DROP POLICY IF EXISTS "checklist_templates_select" ON public.checklist_templates;
CREATE POLICY "checklist_templates_select" ON public.checklist_templates
  FOR SELECT TO authenticated USING (TRUE);

-- INSERT / UPDATE / DELETE — manager (admin) only.
DROP POLICY IF EXISTS "checklist_templates_insert" ON public.checklist_templates;
CREATE POLICY "checklist_templates_insert" ON public.checklist_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "checklist_templates_update" ON public.checklist_templates;
CREATE POLICY "checklist_templates_update" ON public.checklist_templates
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "checklist_templates_delete" ON public.checklist_templates;
CREATE POLICY "checklist_templates_delete" ON public.checklist_templates
  FOR DELETE TO authenticated USING (public.is_admin());

-- Seed the 12 office work-lists (Kaufman, 2026-06-11). is_system = factory
-- default. Idempotent on template_key — re-running won't duplicate or clobber
-- admin edits.
INSERT INTO public.checklist_templates (template_key, group_key, name_he, name_en, sort_order, is_system, items) VALUES
  ('case_opening', 'identity', 'פרטי לווים (פתיחת תיק)', 'Borrower details (case opening)', 10, TRUE,
    jsonb_build_array('מספר נייד – כל הלווים','כתובת אימייל – כל הלווים','כתובת מגורים','צילום תעודות זהות בתוקף + ספח מלא','ציון מספר ילדים מתחת לגיל 18')),
  ('foreign_resident_israel', 'identity', 'תושב חוץ המתגורר בישראל', 'Foreign resident living in Israel', 20, TRUE,
    jsonb_build_array('דרכון בתוקף (לכל הלווים)','זיהוי נוסף עם תמונה (רישיון נהיגה, ואם אין – תעודת נישואין)','ויזה בתוקף','אישור עבודה (אם עובד בישראל)','בדיקה: מספר דרכון עדכני רשום בטאבו')),
  ('foreign_resident_abroad', 'identity', 'תושב חוץ המתגורר בחו״ל', 'Foreign resident living abroad', 30, TRUE,
    jsonb_build_array('דרכון בתוקף (לכל הלווים)','זיהוי נוסף עם תמונה','בדיקה: מספר דרכון עדכני רשום בטאבו')),
  ('israel_banking', 'income', 'הכנסות מישראל – מסמכים בנקאיים', 'Israeli income – banking documents', 40, TRUE,
    jsonb_build_array('דפי עו״ש – 3 חודשים אחרונים','אישור ניהול חשבון','אישור יתרות והלוואות (גם אם 0)','אישורי יתרות מגופים חוץ־בנקאיים (אם קיימים)')),
  ('israel_employee', 'income', 'שכיר', 'Employee', 50, TRUE,
    jsonb_build_array('3 תלושי שכר אחרונים')),
  ('israel_self_employed', 'income', 'עצמאי', 'Self-employed', 60, TRUE,
    jsonb_build_array('שומת מס – שנתיים אחרונות','אישור רו״ח לשנה שטרם דווחה','תעודת עוסק פטור / מורשה','אישור כולל + שעות לימוד (אם יש)','תצהיר דיין עד 8,000 ש״ח בנוסח הבנק','בדיקה: כל ההכנסות משוקפות בעו״ש')),
  ('income_usa', 'income', 'הכנסות מארה״ב', 'US income', 70, TRUE,
    jsonb_build_array('טפסי 1040 – שנתיים אחרונות','Credit Report עדכני','Credit Score עדכני','דפי עו״ש – 3 חודשים אחרונים (ארה״ב)','אישור רו״ח לשנה אחרונה (שאין עליה עדיין 1040)')),
  ('income_uk', 'income', 'הכנסות מאנגליה', 'UK income', 80, TRUE,
    jsonb_build_array('P60 – שנתיים אחרונות (שנת המס מתחילה באפריל)','אישור HMRC','אישור רו״ח לשנה שאין עליה P60','דפי עו״ש – 3 חודשים אחרונים (אנגליה)','Credit Report')),
  ('refinance', 'process', 'מיחזור הלוואה מבנק אחר', 'Refinance from another bank', 90, TRUE,
    jsonb_build_array('מכתב כוונות','אישור התנהלות – שנתיים אחרונות מהבנק הקודם')),
  ('insurance_appraisal', 'process', 'ביטוחים ושמאות', 'Insurance & appraisal', 100, TRUE,
    jsonb_build_array('ביטוח חיים לכל הלווים – על סכום המשכנתא','ביטוח נכס לפי ערך כינון שמאי','בדיקה: דירת קבלן בבנייה – ללא שמאות וללא ביטוח נכס')),
  ('standing_order', 'process', 'הוראת קבע לאחר אישור הלוואה', 'Standing order after loan approval', 110, TRUE,
    jsonb_build_array('פתיחת הרשאה לחיוב חשבון (ללא הגבלת זמן וסכום)','פתיחה מהבנק שממנו ירד החיוב החודשי','על שם וקוד מוסד של הבנק המלווה (לאומי 771 · מזרחי 704 · דיסקונט 700 · פועלים 812 · ירושלים 247)','בחירת יום חיוב חודשי ע״י הלקוח')),
  ('payment_expenses', 'process', 'הוצאות ואמצעי תשלום', 'Fees & payment method', 120, TRUE,
    jsonb_build_array('קבלת מספר כרטיס אשראי','הסבר ללקוח על הוצאות נלוות: רישום טאבו כ־200 ₪ · נסח טאבו 17 ₪ · תשריט בית משותף 37 ₪ · עיון רשם משכונות 12 ₪ לכל לווה','הדגשה ללקוח: סכומים קטנים בלבד'))
ON CONFLICT (template_key) DO NOTHING;

INSERT INTO public.schema_version (version) VALUES (189) ON CONFLICT DO NOTHING;
