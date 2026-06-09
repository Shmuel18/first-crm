-- =============================================================================
-- Migration 158: bank-logos Storage bucket (admin-managed lender logos)
-- =============================================================================
-- The banks lookup table already supports user-added lenders (is_system flag,
-- lender_type bank/non_bank_lender, logo_url, banks_admin_all RLS from 011).
-- The only missing piece for a self-service "manage banks" admin screen is a
-- place to upload logos. Seeded banks point logo_url at /public/banks/*; new
-- ones get a public URL from this bucket.
--
-- Public bucket: logos are non-sensitive brand assets and render in <img>/next
-- Image via a stable public URL. Writes are admin-only.
-- Dependencies: 003 (banks), 011 (is_admin), 017 (storage bucket pattern).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Read: anyone (public brand logos; also served via the public object URL).
DROP POLICY IF EXISTS "bank_logos_read" ON storage.objects;
CREATE POLICY "bank_logos_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'bank-logos');

-- Write / replace / remove: admins only.
DROP POLICY IF EXISTS "bank_logos_insert" ON storage.objects;
CREATE POLICY "bank_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-logos' AND public.is_admin());

DROP POLICY IF EXISTS "bank_logos_update" ON storage.objects;
CREATE POLICY "bank_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bank-logos' AND public.is_admin())
  WITH CHECK (bucket_id = 'bank-logos' AND public.is_admin());

DROP POLICY IF EXISTS "bank_logos_delete" ON storage.objects;
CREATE POLICY "bank_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bank-logos' AND public.is_admin());

INSERT INTO public.schema_version (version) VALUES (158) ON CONFLICT DO NOTHING;
