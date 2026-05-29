-- =============================================================================
-- Migration 095: Simulator permissions
-- =============================================================================

INSERT INTO public.permissions (key, name_he, name_en, category) VALUES
  ('view_simulators', 'לראות סימולטורי משכנתא', 'View Mortgage Simulators', 'view'),
  ('use_simulators', 'להשתמש בסימולטורי משכנתא', 'Use Mortgage Simulators', 'cases'),
  ('manage_simulator_settings', 'לנהל הגדרות סימולטורים', 'Manage Simulator Settings', 'system')
ON CONFLICT (key) DO UPDATE
  SET name_he = EXCLUDED.name_he,
      name_en = EXCLUDED.name_en,
      category = EXCLUDED.category;

INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, TRUE
  FROM public.roles r
 CROSS JOIN public.permissions p
 WHERE r.key = 'admin'
   AND p.key IN ('view_simulators', 'use_simulators', 'manage_simulator_settings')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET is_granted = TRUE;

INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, TRUE
  FROM public.roles r
 CROSS JOIN public.permissions p
 WHERE r.key IN ('senior_advisor', 'junior_advisor')
   AND p.key IN ('view_simulators', 'use_simulators')
ON CONFLICT (role_id, permission_id) DO NOTHING;

