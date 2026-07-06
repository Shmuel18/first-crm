-- =============================================================================
-- Migration 216: gender-neutral secretary role label (מזכירה → מזכיר/ה)
-- =============================================================================
-- The secretary role shipped with a feminine-only Hebrew name ('מזכירה', seed in
-- mig 002). The office also employs male secretaries, so relabel to the
-- gender-neutral slash form 'מזכיר/ה'. Every UI surface reads roles.name_he for
-- the display label (no i18n/hardcoded copy for role names), so this data update
-- changes it everywhere. English 'Secretary' is already neutral — unchanged.
-- Role key + permissions untouched; data-only and idempotent.
-- Deps: 002 (roles seed).
-- =============================================================================

UPDATE public.roles
   SET name_he = 'מזכיר/ה'
 WHERE key = 'secretary'
   AND name_he = 'מזכירה';

INSERT INTO public.schema_version (version) VALUES (216) ON CONFLICT DO NOTHING;
