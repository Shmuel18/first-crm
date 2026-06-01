-- =============================================================================
-- Migration 108: 5th document category — "שונות" (Miscellaneous)
-- =============================================================================
-- Adds a catch-all "misc" category (Drive subfolder 05_שונות). Office-expense
-- invoices are routed here too (decision: no dedicated invoices folder), so the
-- mirror target in receipt-drive.service.ts moves from 'expenses' to 'misc'.
--
-- The drive_folder CHECK from migration 003 only allowed the original four
-- folders; widen it to include 'misc'. The constraint is dropped by lookup (its
-- exact name may vary) so this stays robust + idempotent.
-- =============================================================================

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'public.document_categories'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%drive_folder%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_categories DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.document_categories
  ADD CONSTRAINT document_categories_drive_folder_check
  CHECK (drive_folder IN ('identity', 'income_il', 'income_abroad', 'insurance_collateral', 'misc'));

INSERT INTO public.document_categories (key, name_he, name_en, drive_folder, sort_order, is_system)
VALUES ('misc', 'שונות', 'Miscellaneous', 'misc', 40, TRUE)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
