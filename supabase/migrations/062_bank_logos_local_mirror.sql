-- =============================================================================
-- Migration 062: Point banks.logo_url at locally-mirrored SVGs
-- =============================================================================
-- Removes the runtime dependency on upload.wikimedia.org. Migration 019
-- pointed each bank's logo_url at a Wikipedia commons SVG; the dashboard
-- loaded one per row × density on every render. Pros of mirroring:
--   - No cross-origin request per bank cell (faster, no CORS/CSP friction)
--   - Survives a Wikimedia rate-limit / outage
--   - Survives the source SVG being renamed or replaced upstream
--   - Drops `upload.wikimedia.org` from next.config.ts remotePatterns
--
-- Assets live in /public/banks/*.svg (committed to the repo alongside this
-- migration). The TODO in migration 019 is now resolved.
-- =============================================================================

UPDATE public.banks SET logo_url = '/banks/hapoalim.svg'   WHERE key = 'hapoalim';
UPDATE public.banks SET logo_url = '/banks/leumi.svg'      WHERE key = 'leumi';
UPDATE public.banks SET logo_url = '/banks/mizrahi.svg'    WHERE key = 'mizrahi';
UPDATE public.banks SET logo_url = '/banks/discount.svg'   WHERE key = 'discount';
UPDATE public.banks SET logo_url = '/banks/jerusalem.svg'  WHERE key = 'jerusalem';
