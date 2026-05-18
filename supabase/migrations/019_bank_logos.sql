-- =============================================================================
-- Migration 019: Bank Logos
-- =============================================================================
-- Purpose: Populate banks.logo_url with real Wikipedia/Wikimedia SVG URLs.
-- Source: each bank's English Wikipedia article infobox (publicly licensed).
--
-- Coverage:
--   ✓ Mizrahi-Tefahot, Hapoalim, Leumi, Jerusalem, Discount  (5 banks)
--   ✗ BTB, Albar - private/smaller lenders, no Wikipedia logos.
--     UI falls back to a colored box with the first 2 chars of the name.
--
-- TODO: mirror these to a public 'bank-logos' Supabase Storage bucket later
--       so we don't depend on Wikipedia. External URLs are stable but
--       self-hosting is more resilient.
-- Dependencies: 003_lookups.sql, 004_lookups_seed.sql
-- =============================================================================

UPDATE public.banks SET logo_url =
  'https://upload.wikimedia.org/wikipedia/commons/4/45/Bank_hapoalim_2001_logo.svg'
WHERE key = 'hapoalim';

UPDATE public.banks SET logo_url =
  'https://upload.wikimedia.org/wikipedia/en/f/f8/Bank_Leumi_logo.svg'
WHERE key = 'leumi';

UPDATE public.banks SET logo_url =
  'https://upload.wikimedia.org/wikipedia/commons/6/62/%D7%9C%D7%95%D7%92%D7%95_%D7%A9%D7%9C_%D7%91%D7%A0%D7%A7_%D7%9E%D7%96%D7%A8%D7%97%D7%99-%D7%98%D7%A4%D7%97%D7%95%D7%AA.svg'
WHERE key = 'mizrahi';

UPDATE public.banks SET logo_url =
  'https://upload.wikimedia.org/wikipedia/commons/6/6f/Discount_Bank%2C_Ltd_logo.svg'
WHERE key = 'discount';

UPDATE public.banks SET logo_url =
  'https://upload.wikimedia.org/wikipedia/en/3/3a/Bank_of_Jerusalem_logo.svg'
WHERE key = 'jerusalem';
