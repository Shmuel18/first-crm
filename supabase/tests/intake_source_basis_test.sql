-- =============================================================================
-- R4-legal-2: intake source/basis tests (pgTAP) — migration 175
-- =============================================================================
-- Run with:  supabase test db   (needs a local stack: `supabase start`)
--
-- Proves submit_public_intake records the correct legal basis per source:
--   * 'web_contact'   → metadata.privacy_notice (NO consent.agreed), and the
--     synthesized consent flag is stripped from the stored payload.
--   * 'public_intake' → metadata.consent { agreed:true, ... } (UNCHANGED), and
--     a submission without consent is refused.
-- No seeded users needed: the admin-bell INSERT simply matches zero rows.
-- Whole file ROLLBACKs at the end.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

-- ---- web_contact: privacy-notice basis, no affirmative consent --------------
CREATE TEMP TABLE _wc AS
SELECT public.submit_public_intake(
  '{"borrowers":[{"first_name":"Web","email":"web@example.com"}],"locale":"en","consent":true}'::jsonb,
  '2026-06', '203.0.113.9', 'web_contact'
) AS id;

SELECT is((SELECT l.metadata->>'source' FROM public.leads l JOIN _wc ON l.id = _wc.id),
  'web_contact', 'web_contact lead is tagged metadata.source = web_contact');
SELECT is((SELECT l.metadata->'privacy_notice'->>'policy_version' FROM public.leads l JOIN _wc ON l.id = _wc.id),
  '2026-06', 'web_contact records a privacy_notice with the policy version');
SELECT is((SELECT l.metadata->'privacy_notice'->>'source' FROM public.leads l JOIN _wc ON l.id = _wc.id),
  'web_contact', 'the privacy_notice records the originating source');
SELECT ok((SELECT l.metadata->'consent' IS NULL FROM public.leads l JOIN _wc ON l.id = _wc.id),
  'web_contact stores NO affirmative consent record (consent.agreed=true)');
SELECT ok((SELECT NOT (l.metadata->'payload' ? 'consent') FROM public.leads l JOIN _wc ON l.id = _wc.id),
  'web_contact strips the synthesized consent flag from the stored payload');

-- ---- public_intake (/check): affirmative consent basis, unchanged -----------
CREATE TEMP TABLE _pi AS
SELECT public.submit_public_intake(
  '{"borrowers":[{"first_name":"Quiz","email":"quiz@example.com"}],"locale":"he","consent":true}'::jsonb,
  '2026-06', '203.0.113.10'   -- p_source defaults to public_intake
) AS id;

SELECT is((SELECT l.metadata->>'source' FROM public.leads l JOIN _pi ON l.id = _pi.id),
  'public_intake', '/check lead is tagged metadata.source = public_intake');
SELECT is((SELECT l.metadata->'consent'->>'agreed' FROM public.leads l JOIN _pi ON l.id = _pi.id),
  'true', '/check records an affirmative consent record (agreed=true)');
SELECT ok((SELECT l.metadata->'privacy_notice' IS NULL FROM public.leads l JOIN _pi ON l.id = _pi.id),
  '/check does NOT record a privacy_notice (consent basis only)');

-- ---- /check still DB-enforces consent ---------------------------------------
SELECT throws_ok(
  $$ SELECT public.submit_public_intake(
       '{"borrowers":[{"first_name":"NoConsent","email":"n@example.com"}],"locale":"he"}'::jsonb,
       '2026-06', '203.0.113.11') $$,
  '22023', NULL,
  'a /check submission WITHOUT consent is refused (DB defense-in-depth)');

SELECT * FROM finish();
ROLLBACK;
