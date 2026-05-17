-- =============================================================================
-- Migration 004: Lookup Tables Seed Data
-- =============================================================================
-- Purpose: Initial seed data for all lookup tables
-- Dependencies: 003_lookups.sql
-- Note: ON CONFLICT DO NOTHING - safe to re-run
-- =============================================================================

-- =============================================================================
-- Case Statuses (11 from Kaufman's Excel)
-- =============================================================================
INSERT INTO public.case_statuses (key, name_he, name_en, color, sort_order, is_terminal, is_system) VALUES
  ('case_opened', 'פתיחת תיק', 'Case Opened', '#888888', 1, FALSE, TRUE),
  ('document_collection', 'איסוף מסמכים', 'Document Collection', '#FF8C00', 2, FALSE, TRUE),
  ('ready_for_submission', 'מוכן להגשה', 'Ready for Submission', '#28A745', 3, FALSE, TRUE),
  ('submitted_to_bank', 'הוגש לבנק', 'Submitted to Bank', '#1E7E34', 4, FALSE, TRUE),
  ('awaiting_pre_approval', 'בהמתנה לאישור עקרוני', 'Awaiting Pre-Approval', '#FFC107', 5, FALSE, TRUE),
  ('pre_approved', 'אושר עקרונית', 'Pre-Approved', '#FFEB3B', 6, FALSE, TRUE),
  ('collateral', 'בטחונות', 'Collateral', '#6F4E37', 7, FALSE, TRUE),
  ('execution', 'ביצוע', 'Execution', '#007BFF', 8, FALSE, TRUE),
  ('closed', 'נסגר', 'Closed', '#000000', 9, TRUE, TRUE),
  ('stuck', 'תקוע', 'Stuck', '#DC3545', 10, FALSE, TRUE),
  ('on_hold', 'בהקפאה', 'On Hold', '#F5F5F5', 11, FALSE, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Case Bank Statuses
-- =============================================================================
INSERT INTO public.case_bank_statuses (key, name_he, name_en, color, sort_order, is_system) VALUES
  ('pending_submission', 'ממתין להגשה', 'Pending Submission', '#888888', 1, TRUE),
  ('submitted', 'הוגש', 'Submitted', '#1E7E34', 2, TRUE),
  ('under_review', 'בבדיקה', 'Under Review', '#FFC107', 3, TRUE),
  ('pre_approved', 'אושר עקרונית', 'Pre-Approved', '#FFEB3B', 4, TRUE),
  ('approved', 'אושר', 'Approved', '#28A745', 5, TRUE),
  ('rejected', 'נדחה', 'Rejected', '#DC3545', 6, TRUE),
  ('withdrawn', 'משוך', 'Withdrawn', '#6C757D', 7, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Case Types (6 from Kaufman)
-- =============================================================================
INSERT INTO public.case_types (key, name_he, name_en, sort_order, is_system) VALUES
  ('contractor', 'קבלן', 'From Contractor', 1, TRUE),
  ('second_hand', 'יד שניה', 'Second Hand', 2, TRUE),
  ('refinance', 'מחזור', 'Refinance', 3, TRUE),
  ('transfer', 'גרירה', 'Transfer', 4, TRUE),
  ('any_purpose', 'לכל מטרה', 'Any Purpose', 5, TRUE),
  ('renovation', 'שיפוצים', 'Renovation', 6, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Banks (7 - Kaufman's actual list)
-- =============================================================================
INSERT INTO public.banks (key, name_he, name_en, color, lender_type, sort_order, is_system) VALUES
  ('mizrahi', 'מזרחי טפחות', 'Mizrahi-Tefahot', '#FF6B00', 'bank', 1, TRUE),
  ('hapoalim', 'פועלים', 'Hapoalim', '#DC3545', 'bank', 2, TRUE),
  ('leumi', 'לאומי', 'Leumi', '#003D7A', 'bank', 3, TRUE),
  ('jerusalem', 'ירושלים', 'Jerusalem', '#FFEB3B', 'bank', 4, TRUE),
  ('btb', 'BTB', 'BTB', '#000000', 'non_bank_lender', 5, TRUE),
  ('discount', 'דיסקונט', 'Discount', '#006B3F', 'bank', 6, TRUE),
  ('albar', 'אלבר', 'Albar', '#90EE90', 'non_bank_lender', 7, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Income Types (10)
-- =============================================================================
INSERT INTO public.income_types (key, name_he, name_en, sort_order, is_system) VALUES
  ('salary', 'שכיר', 'Salary', 1, TRUE),
  ('self_employed', 'עצמאי', 'Self-Employed', 2, TRUE),
  ('rental', 'שכ"ד', 'Rental Income', 3, TRUE),
  ('pension', 'פנסיה', 'Pension', 4, TRUE),
  ('allowance', 'קצבה', 'Allowance', 5, TRUE),
  ('child_benefits', 'קצבת ילדים', 'Child Benefits', 6, TRUE),
  ('kollel_stipend', 'מלגת כולל', 'Kollel Stipend', 7, TRUE),
  ('dividends', 'דיבידנדים מחברה', 'Dividends from Company', 8, TRUE),
  ('foreign_income', 'הכנסות מחו"ל', 'Foreign Income', 9, TRUE),
  ('other', 'אחר', 'Other', 10, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Document Categories (initial - to be refined with Kaufman)
-- =============================================================================
-- Identity folder
INSERT INTO public.document_categories (key, name_he, name_en, drive_folder, sort_order, is_system) VALUES
  ('id_card', 'תעודת זהות', 'ID Card', 'identity', 1, TRUE),
  ('driver_license', 'רישיון נהיגה', 'Driver License', 'identity', 2, TRUE),
  ('passport', 'דרכון', 'Passport', 'identity', 3, TRUE),
  ('marriage_certificate', 'תעודת נישואין', 'Marriage Certificate', 'identity', 4, TRUE),
  ('divorce_papers', 'הסכם גירושין', 'Divorce Papers', 'identity', 5, TRUE),
-- Income (Israel) folder
  ('payslip', 'תלוש שכר', 'Payslip', 'income_il', 10, TRUE),
  ('form_106', 'טופס 106', 'Form 106', 'income_il', 11, TRUE),
  ('employer_letter', 'אישור מעסיק', 'Employer Letter', 'income_il', 12, TRUE),
  ('tax_assessment', 'שומת מס', 'Tax Assessment', 'income_il', 13, TRUE),
  ('bank_statement', 'תדפיס בנק', 'Bank Statement', 'income_il', 14, TRUE),
  ('vat_registration', 'אישור עוסק מורשה', 'VAT Registration', 'income_il', 15, TRUE),
  ('rental_contract', 'חוזה שכירות', 'Rental Contract', 'income_il', 16, TRUE),
-- Income (Foreign) folder
  ('foreign_payslip', 'תלוש שכר זר', 'Foreign Payslip', 'income_abroad', 20, TRUE),
  ('foreign_employer_letter', 'אישור מעסיק זר', 'Foreign Employer Letter', 'income_abroad', 21, TRUE),
  ('foreign_bank_statement', 'תדפיס בנק זר', 'Foreign Bank Statement', 'income_abroad', 22, TRUE),
-- Insurance & Collateral folder
  ('life_insurance_quote', 'הצעת ביטוח חיים', 'Life Insurance Quote', 'insurance_collateral', 30, TRUE),
  ('life_insurance_policy', 'פוליסת ביטוח חיים', 'Life Insurance Policy', 'insurance_collateral', 31, TRUE),
  ('property_insurance', 'ביטוח מבנה', 'Property Insurance', 'insurance_collateral', 32, TRUE),
  ('property_deed', 'נסח טאבו', 'Property Deed (Tabu)', 'insurance_collateral', 33, TRUE),
  ('purchase_contract', 'חוזה רכישה', 'Purchase Contract', 'insurance_collateral', 34, TRUE),
  ('appraisal', 'שמאות', 'Appraisal', 'insurance_collateral', 35, TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Default Role-Permission Matrix
-- =============================================================================
-- Maps each role to its default permissions
-- Admin = ALL permissions

-- Admin: grant ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM public.roles WHERE key = 'admin'),
  p.id,
  TRUE
FROM public.permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Senior Advisor
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM public.roles WHERE key = 'senior_advisor'),
  p.id,
  TRUE
FROM public.permissions p
WHERE p.key IN (
  'view_dashboard',
  'view_own_leads', 'view_all_leads',
  'view_own_cases', 'view_all_cases', 'view_archived_cases',
  'view_case_documents', 'view_case_obligations', 'view_case_incomes',
  'view_case_fee',
  'create_case', 'edit_own_case', 'edit_any_case',
  'archive_case', 'restore_archived_case',
  'convert_lead_to_case', 'assign_case_to_user', 'change_case_status',
  'create_lead', 'edit_lead', 'delete_lead',
  'upload_document', 'delete_document', 'verify_document'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Junior Advisor
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM public.roles WHERE key = 'junior_advisor'),
  p.id,
  TRUE
FROM public.permissions p
WHERE p.key IN (
  'view_dashboard',
  'view_own_leads',
  'view_own_cases',
  'view_case_documents', 'view_case_obligations', 'view_case_incomes',
  'create_case', 'edit_own_case',
  'convert_lead_to_case', 'change_case_status',
  'create_lead', 'edit_lead',
  'upload_document'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Secretary
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM public.roles WHERE key = 'secretary'),
  p.id,
  TRUE
FROM public.permissions p
WHERE p.key IN (
  'view_dashboard',
  'view_own_leads', 'view_all_leads',
  'view_own_cases', 'view_all_cases', 'view_archived_cases',
  'view_case_documents',
  'create_case', 'edit_own_case',
  'convert_lead_to_case',
  'create_lead', 'edit_lead',
  'upload_document'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
