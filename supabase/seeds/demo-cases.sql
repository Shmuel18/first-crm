-- =============================================================================
-- Demo seed: 35 cases for dashboard testing
-- =============================================================================
-- Scope: dashboard-visible data only (borrowers name/id/phone, primary +
--        secondary banks, status, short_note, blocker, insurance).
--        Does NOT seed incomes or obligations.
--
-- Marker: every row gets metadata->>'seed_batch' = 'demo_v1'.
--
-- Cleanup (run from SQL editor to remove ALL demo rows):
--     DELETE FROM borrowers WHERE metadata->>'seed_batch' = 'demo_v1';
--     DELETE FROM cases     WHERE metadata->>'seed_batch' = 'demo_v1';
--     -- case_borrowers / case_banks cascade automatically.
--
-- Re-running:
--     The script aborts if any demo_v1 rows already exist. Clean up first,
--     then re-run.
--
-- Distribution (35 cases across 11 statuses):
--     case_opened           3   pre_approved   3   stuck     3
--     document_collection   7   collateral     2   on_hold   1
--     ready_for_submission  4   execution      2
--     submitted_to_bank     4   closed         2
--     awaiting_pre_approval 4
-- =============================================================================

DO $$
DECLARE
  admin_id       UUID;
  existing_count INT;
  case_id_var    UUID;
  borrower1_id   UUID;
  borrower2_id   UUID;
  rec            RECORD;
BEGIN
  -- ---------------------------------------------------------------------
  -- Pre-flight checks
  -- ---------------------------------------------------------------------
  SELECT id INTO admin_id
  FROM public.profiles
  WHERE email = 'shh92533@gmail.com'
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin profile not found for shh92533@gmail.com. Log in once before seeding.';
  END IF;

  SELECT COUNT(*) INTO existing_count
  FROM public.cases
  WHERE metadata->>'seed_batch' = 'demo_v1';

  IF existing_count > 0 THEN
    RAISE EXCEPTION
      'Demo seed already exists (% cases). Clean up first: DELETE FROM cases WHERE metadata->>''seed_batch'' = ''demo_v1''',
      existing_count;
  END IF;

  -- ---------------------------------------------------------------------
  -- 35 cases, hand-curated for realistic dashboard variety
  -- ---------------------------------------------------------------------
  FOR rec IN
    SELECT * FROM (VALUES
      -- (status_key, case_type_key,
      --  b1_first, b1_last, b1_national_id, b1_phone,
      --  b2_first, b2_last, b2_national_id, b2_phone,
      --  primary_bank_key, secondary_bank_key, banker_name,
      --  property_value, mortgage_amount,
      --  short_note, blocker, insurance, referrer)

      -- ============ case_opened (3) ============
      ('case_opened',          'second_hand',  'יוסי',    'כהן',     '301234567', '0501112233', 'שרה',    'כהן',     '302345678', '0521112233', 'mizrahi',   NULL,       'דוד לוי',         2200000, 1540000, 'פגישה ראשונה השבוע',                  'none',      'missing',     'אבי הראל'),
      ('case_opened',          'contractor',   'אברהם',   'לוי',     '303456789', '0531112233',  NULL,    NULL,       NULL,        NULL,         'hapoalim',  NULL,       'יוסי שטרית',      1850000, 1387500,  NULL,                                  'none',      'missing',     NULL),
      ('case_opened',          'refinance',    'דוד',     'פרץ',     '304567890', '0541112233', 'מרים',   'פרץ',     '305678901', '0551112233', 'leumi',     'mizrahi',  'רינת אזולאי',     1650000, 1100000, 'לחזור אליו ביום ראשון',               'none',      'in_progress', 'הילה רוזן'),

      -- ============ document_collection (7) ============
      ('document_collection',  'second_hand',  'שמואל',   'מזרחי',   '306789012', '0561112233', 'רחל',    'מזרחי',   '307890123', '0571112233', 'mizrahi',   'discount', 'מאיר חדד',        2800000, 1960000, 'חסר תלוש שכר ינואר',                 'client',    'in_progress', NULL),
      ('document_collection',  'contractor',   'חיים',    'אזולאי',  '308901234', '0581112233',  NULL,    NULL,       NULL,        NULL,         'jerusalem', NULL,       'נועה ביטון',      2100000, 1575000, 'לבקש 106 ממעסיק חדש',                'client',    'missing',     'אבי הראל'),
      ('document_collection',  'second_hand',  'יהודה',   'חביב',    '309012345', '0501222233', 'אסתר',   'חביב',    '310123456', '0501333344', 'hapoalim',  'leumi',    'תמיר אוחיון',     3200000, 2240000,  NULL,                                  'none',      'in_progress', NULL),
      ('document_collection',  'refinance',    'משה',     'אברהמי',  '311234567', '0501333355', 'לאה',    'אברהמי',  '312345678', '0501444455', 'discount',  NULL,       'אסף יוסף',        1500000, 950000,  'מסמכים אצל הלקוח',                   'client',    'exists',      'מיכל גולדמן'),
      ('document_collection',  'transfer',     'אהרון',   'גבאי',    '313456789', '0501555566',  NULL,    NULL,       NULL,        NULL,         'btb',       'albar',    NULL,              1750000, 1300000, 'אישור מהבנק הישן ביום שני',         'bank',      'in_progress', NULL),
      ('document_collection',  'any_purpose',  'יעקב',    'אמסלם',   '314567890', '0501666677', 'אביגיל', 'אמסלם',   '315678901', '0501777788', 'leumi',     NULL,       'רחל פרידמן',      1300000, 800000,   NULL,                                  'none',      'exists',      NULL),
      ('document_collection',  'renovation',   'נתן',     'יצחק',    '316789012', '0501888899',  NULL,    NULL,       NULL,        NULL,         'jerusalem', NULL,       'אבי שפירא',       950000,  450000,  'לוודא עם הקבלן הרשאה',                'office',    'missing',     'דנה מלכא'),

      -- ============ ready_for_submission (4) ============
      ('ready_for_submission', 'second_hand',  'מאיר',    'בן דוד',  '317890123', '0501999900', 'רינת',   'בן דוד',  '318901234', '0501999911', 'mizrahi',   'hapoalim', 'דוד לוי',         2600000, 1820000, 'מחכים לשמאות',                       'appraiser', 'in_progress', NULL),
      ('ready_for_submission', 'contractor',   'בנימין',  'מלכא',    '319012345', '0501999922',  NULL,    NULL,       NULL,        NULL,         'hapoalim',  NULL,       'יוסי שטרית',      2400000, 1800000,  NULL,                                  'none',      'exists',      'אסף שלום'),
      ('ready_for_submission', 'refinance',    'אריה',    'ביטון',   '320123456', '0501999933', 'נעמה',   'ביטון',   '321234567', '0501999944', 'leumi',     'discount', 'רינת אזולאי',     1900000, 1300000, 'מחר הגשה',                            'none',      'in_progress', NULL),
      ('ready_for_submission', 'any_purpose',  'יצחק',    'שטרית',   '322345678', '0521999955', 'מיכל',   'שטרית',   '323456789', '0521999966', 'discount',  NULL,       'אסף יוסף',        1100000, 700000,   NULL,                                  'none',      'exists',      'הילה רוזן'),

      -- ============ submitted_to_bank (4) ============
      ('submitted_to_bank',    'second_hand',  'רחמים',   'אוחיון',  '324567890', '0521999977',  NULL,    NULL,       NULL,        NULL,         'mizrahi',   NULL,       'מאיר חדד',        2300000, 1610000, 'בבדיקת חתם',                          'bank',      'exists',      NULL),
      ('submitted_to_bank',    'contractor',   'גבריאל',  'דנינו',   '325678901', '0521999988', 'דנה',    'דנינו',   '326789012', '0521999999', 'jerusalem', 'mizrahi',  'נועה ביטון',      3500000, 2450000,  NULL,                                  'bank',      'in_progress', 'מיכל גולדמן'),
      ('submitted_to_bank',    'refinance',    'שלום',    'סבג',     '327890123', '0531999911', 'נחמה',   'סבג',     '328901234', '0531999922', 'hapoalim',  NULL,       'תמיר אוחיון',     1700000, 1100000,  NULL,                                  'none',      'exists',      NULL),
      ('submitted_to_bank',    'transfer',     'יוסי',    'יוסף',    '329012345', '0531999933',  NULL,    NULL,       NULL,        NULL,         'leumi',     'btb',      'רחל פרידמן',      2000000, 1500000, 'תשובה ביום חמישי',                    'bank',      'exists',      'אבי הראל'),

      -- ============ awaiting_pre_approval (4) ============
      ('awaiting_pre_approval','second_hand',  'אברהם',   'אטיאס',   '330123456', '0531999944', 'ציפי',   'אטיאס',   '331234567', '0531999955', 'mizrahi',   'jerusalem','דוד לוי',         2900000, 2030000, 'מחכים לעקרוני',                       'bank',      'in_progress', NULL),
      ('awaiting_pre_approval','second_hand',  'דוד',     'סויסה',   '332345678', '0541999966',  NULL,    NULL,       NULL,        NULL,         'discount',  NULL,       'אסף יוסף',        2400000, 1680000,  NULL,                                  'bank',      'in_progress', 'דנה מלכא'),
      ('awaiting_pre_approval','contractor',   'שמואל',   'אדרי',    '333456789', '0541999977', 'ענת',    'אדרי',    '334567890', '0541999988', 'jerusalem', 'hapoalim', 'נועה ביטון',      3100000, 2170000, 'התקשרה מהבנק - חוזר אלי',           'bank',      'exists',      NULL),
      ('awaiting_pre_approval','any_purpose',  'חיים',    'אסולין',  '335678901', '0541999999', 'יעל',    'אסולין',  '336789012', '0551999911', 'btb',       NULL,       NULL,              1250000, 800000,   NULL,                                  'bank',      'exists',      'הילה רוזן'),

      -- ============ pre_approved (3) ============
      ('pre_approved',         'second_hand',  'יהודה',   'אלקובי',  '337890123', '0551999922', 'אורית',  'אלקובי',  '338901234', '0551999933', 'mizrahi',   'leumi',    'דוד לוי',         2700000, 1890000, 'אישור בכיס',                          'none',      'exists',      NULL),
      ('pre_approved',         'refinance',    'משה',     'חזן',     '339012345', '0551999944',  NULL,    NULL,       NULL,        NULL,         'hapoalim',  NULL,       'יוסי שטרית',      1850000, 1200000, 'לקבוע פגישת חתימה',                  'none',      'exists',      'מיכל גולדמן'),
      ('pre_approved',         'contractor',   'אהרון',   'חליווה',  '340123456', '0561999955', 'רבקה',   'חליווה',  '341234567', '0561999966', 'jerusalem', NULL,       'נועה ביטון',      3300000, 2310000,  NULL,                                  'none',      'in_progress', NULL),

      -- ============ collateral (2) ============
      ('collateral',           'second_hand',  'יעקב',    'רובין',   '342345678', '0561999977', 'חנה',    'רובין',   '343456789', '0561999988', 'mizrahi',   'discount', 'מאיר חדד',        3000000, 2100000, 'שטר התחייבות נחתם',                  'lawyer',    'exists',      'אבי הראל'),
      ('collateral',           'transfer',     'נתן',     'פרידמן',  '344567890', '0561999999',  NULL,    NULL,       NULL,        NULL,         'leumi',     NULL,       'רחל פרידמן',      2100000, 1500000,  NULL,                                  'lawyer',    'exists',      NULL),

      -- ============ execution (2) ============
      ('execution',            'second_hand',  'מאיר',    'שפירא',   '345678901', '0571999911', 'אביגיל', 'שפירא',   '346789012', '0571999922', 'hapoalim',  'mizrahi',  'יוסי שטרית',      2600000, 1820000, 'תשלום ראשון השבוע',                  'none',      'exists',      NULL),
      ('execution',            'contractor',   'בנימין',  'רוזנברג', '347890123', '0571999933',  NULL,    NULL,       NULL,        NULL,         'jerusalem', NULL,       'נועה ביטון',      2800000, 1960000,  NULL,                                  'none',      'exists',      'דנה מלכא'),

      -- ============ closed (2) ============
      ('closed',               'second_hand',  'נחמיה',   'הראל',    '348901234', '0571999944', 'תמר',    'הראל',    '349012345', '0571999955', 'mizrahi',   NULL,       'דוד לוי',         2400000, 1680000,  NULL,                                  'none',      'exists',      NULL),
      ('closed',               'refinance',    'יצחק',    'גבאי',    '350123456', '0581999966',  NULL,    NULL,       NULL,        NULL,         'leumi',     NULL,       'רינת אזולאי',     1600000, 1000000,  NULL,                                  'none',      'exists',      'מיכל גולדמן'),

      -- ============ stuck (3) ============
      ('stuck',                'contractor',   'רחמים',   'אזולאי',  '351234567', '0581999977', 'נעמה',   'אזולאי',  '352345678', '0581999988', 'btb',       NULL,       NULL,              1950000, 1450000, 'תקוע בשמאות 3 שבועות',                'appraiser', 'missing',     NULL),
      ('stuck',                'second_hand',  'גבריאל',  'אדרי',    '353456789', '0581999999',  NULL,    NULL,       NULL,        NULL,         'hapoalim',  NULL,       'יוסי שטרית',      2200000, 1540000, 'הבנק לא מגיב 10 ימים',                'bank',      'in_progress', 'הילה רוזן'),
      ('stuck',                'transfer',     'שלום',    'מלכא',    '354567890', '0501777711', 'דנה',    'מלכא',    '355678901', '0501777722', 'discount',  'btb',      NULL,              2000000, 1500000, 'בעיה במשכון הקיים',                  'lawyer',    'in_progress', NULL),

      -- ============ on_hold (1) ============
      ('on_hold',              'any_purpose',  'אריאל',   'בקר',     '356789012', '0501777733',  NULL,    NULL,       NULL,        NULL,         'albar',     NULL,       NULL,              1100000, 700000,  'בהקפאה - הלקוח בחו"ל',                'client',    'missing',     NULL)
    ) AS t(
      status_key, case_type_key,
      b1_first, b1_last, b1_national_id, b1_phone,
      b2_first, b2_last, b2_national_id, b2_phone,
      primary_bank_key, secondary_bank_key, banker_name,
      property_value, mortgage_amount,
      short_note, blocker, insurance, referrer
    )
  LOOP
    -- Insert borrower 1
    INSERT INTO public.borrowers (first_name, last_name, national_id, phone, metadata, created_by, updated_by)
    VALUES (rec.b1_first, rec.b1_last, rec.b1_national_id, rec.b1_phone, '{"seed_batch":"demo_v1"}'::jsonb, admin_id, admin_id)
    RETURNING id INTO borrower1_id;

    -- Insert borrower 2 if present
    IF rec.b2_first IS NOT NULL THEN
      INSERT INTO public.borrowers (first_name, last_name, national_id, phone, metadata, created_by, updated_by)
      VALUES (rec.b2_first, rec.b2_last, rec.b2_national_id, rec.b2_phone, '{"seed_batch":"demo_v1"}'::jsonb, admin_id, admin_id)
      RETURNING id INTO borrower2_id;
    ELSE
      borrower2_id := NULL;
    END IF;

    -- Insert case
    INSERT INTO public.cases (
      case_type_primary_id, status_id, assigned_advisor_id, primary_borrower_id,
      property_value, requested_mortgage_amount, equity,
      short_note, case_blocker, insurance_status, referrer_name,
      metadata, created_by, updated_by
    )
    VALUES (
      (SELECT id FROM public.case_types     WHERE key = rec.case_type_key),
      (SELECT id FROM public.case_statuses  WHERE key = rec.status_key),
      admin_id,
      borrower1_id,
      rec.property_value, rec.mortgage_amount, rec.property_value - rec.mortgage_amount,
      rec.short_note, rec.blocker, rec.insurance, rec.referrer,
      '{"seed_batch":"demo_v1"}'::jsonb,
      admin_id, admin_id
    )
    RETURNING id INTO case_id_var;

    -- Junction: borrower 1 = primary
    INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
    VALUES (case_id_var, borrower1_id, 'borrower', TRUE);

    -- Junction: borrower 2 (non-primary) if present
    IF borrower2_id IS NOT NULL THEN
      INSERT INTO public.case_borrowers (case_id, borrower_id, role_in_case, is_primary)
      VALUES (case_id_var, borrower2_id, 'borrower', FALSE);
    END IF;

    -- Primary bank (status derived from case status)
    INSERT INTO public.case_banks (case_id, bank_id, bank_status_id, is_primary, banker_name, created_by, updated_by)
    VALUES (
      case_id_var,
      (SELECT id FROM public.banks WHERE key = rec.primary_bank_key),
      (SELECT id FROM public.case_bank_statuses WHERE key = CASE rec.status_key
        WHEN 'case_opened'           THEN 'pending_submission'
        WHEN 'document_collection'   THEN 'pending_submission'
        WHEN 'ready_for_submission'  THEN 'pending_submission'
        WHEN 'submitted_to_bank'     THEN 'submitted'
        WHEN 'awaiting_pre_approval' THEN 'under_review'
        WHEN 'pre_approved'          THEN 'pre_approved'
        WHEN 'collateral'            THEN 'approved'
        WHEN 'execution'             THEN 'approved'
        WHEN 'closed'                THEN 'approved'
        WHEN 'stuck'                 THEN 'under_review'
        WHEN 'on_hold'               THEN 'under_review'
      END),
      TRUE,
      rec.banker_name,
      admin_id, admin_id
    );

    -- Secondary bank (always pending_submission - not yet committed to)
    IF rec.secondary_bank_key IS NOT NULL THEN
      INSERT INTO public.case_banks (case_id, bank_id, bank_status_id, is_primary, created_by, updated_by)
      VALUES (
        case_id_var,
        (SELECT id FROM public.banks WHERE key = rec.secondary_bank_key),
        (SELECT id FROM public.case_bank_statuses WHERE key = 'pending_submission'),
        FALSE,
        admin_id, admin_id
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Successfully seeded 35 demo cases (56 borrowers, ~45 case_banks).';
END;
$$;
