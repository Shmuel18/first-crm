-- =============================================================================
-- Migration 183: add "מחיר למשתכן" (Mehir LaMishtaken) case type
-- =============================================================================
-- Kaufman requested an additional transaction type alongside the existing 6
-- (contractor / second_hand / refinance / transfer / any_purpose / renovation).
-- "מחיר למשתכן" is the government subsidized-price new-build program — for the
-- document checklist it behaves like a contractor (new-build) purchase, so its
-- required-documents seed mirrors 'contractor' (see migration 087).
--
-- Case-type names are DATA (name_he/name_en), so the new row surfaces in every
-- dropdown (new case, edit, dashboard filter) automatically — no code change.
-- sort_order 7 places it after 'renovation' (6) and before the 'other' (99)
-- catch-all. Idempotent via ON CONFLICT.
-- Dependencies: 004 (case_types + lookups seed), 008/087 (case_type_documents).
-- =============================================================================

INSERT INTO public.case_types (key, name_he, name_en, sort_order, is_system)
VALUES ('mehir_lamishtaken', 'מחיר למשתכן', 'Mehir LaMishtaken', 7, TRUE)
ON CONFLICT (key) DO NOTHING;

-- Required-documents template for the new type (mirrors 'contractor').
INSERT INTO public.case_type_documents (case_type_id, document_category_id, is_required, required_at_stage_id, sort_order)
SELECT ct.id, dc.id, vals.is_required, cs.id, vals.sort_order
FROM (VALUES
  ('mehir_lamishtaken', 'id_card',              TRUE,  'document_collection',   1),
  ('mehir_lamishtaken', 'payslip',              TRUE,  'document_collection',  10),
  ('mehir_lamishtaken', 'form_106',             TRUE,  'document_collection',  11),
  ('mehir_lamishtaken', 'tax_assessment',       TRUE,  'document_collection',  13),
  ('mehir_lamishtaken', 'bank_statement',       TRUE,  'document_collection',  14),
  ('mehir_lamishtaken', 'purchase_contract',    TRUE,  'document_collection',  30),
  ('mehir_lamishtaken', 'appraisal',            TRUE,  'ready_for_submission', 31),
  ('mehir_lamishtaken', 'property_deed',        TRUE,  'ready_for_submission', 32),
  ('mehir_lamishtaken', 'life_insurance_quote', FALSE, 'ready_for_submission', 40),
  ('mehir_lamishtaken', 'property_insurance',   FALSE, 'ready_for_submission', 41)
) AS vals(case_type_key, category_key, is_required, stage_key, sort_order)
JOIN public.case_types ct ON ct.key = vals.case_type_key
JOIN public.document_categories dc ON dc.key = vals.category_key
LEFT JOIN public.case_statuses cs ON cs.key = vals.stage_key
ON CONFLICT (case_type_id, document_category_id) DO NOTHING;

INSERT INTO public.schema_version (version) VALUES (183) ON CONFLICT DO NOTHING;
