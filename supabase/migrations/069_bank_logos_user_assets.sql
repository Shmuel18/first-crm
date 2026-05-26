-- =============================================================================
-- Migration 069: Point banks.logo_url at the user-supplied logo assets
-- =============================================================================
-- Migration 062 had me mirror Wikimedia SVGs into /public/banks/, but the
-- operator already had branded PNG / JPG / WEBP files in the same folder.
-- Switch each row to the operator's file so the dashboard renders the
-- intended assets instead of the auto-downloaded SVGs.
--
-- File-format note: PNG/JPG/WEBP all render through next/image without
-- runtime config — only the path string changes. Hapoalim/Leumi/Mizrahi
-- moved to PNG (raster); Discount to WEBP; Jerusalem to JPG.
-- =============================================================================

UPDATE public.banks SET logo_url = '/banks/hapoalim.png'   WHERE key = 'hapoalim';
UPDATE public.banks SET logo_url = '/banks/leumi.png'      WHERE key = 'leumi';
UPDATE public.banks SET logo_url = '/banks/mizrahi.png'    WHERE key = 'mizrahi';
UPDATE public.banks SET logo_url = '/banks/discount.webp'  WHERE key = 'discount';
UPDATE public.banks SET logo_url = '/banks/jerusalem.jpg'  WHERE key = 'jerusalem';
