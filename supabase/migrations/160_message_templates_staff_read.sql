-- Templates go live: the case action bar's "send message" picker needs every
-- staff member to READ active templates at send time. Management (insert/
-- update/delete) stays admin-only via the existing message_templates_admin_all
-- policy; this only opens SELECT on active, non-deleted rows.

DROP POLICY IF EXISTS message_templates_staff_read ON public.message_templates;
CREATE POLICY message_templates_staff_read ON public.message_templates
  FOR SELECT TO authenticated
  USING (is_active = TRUE AND deleted_at IS NULL);

INSERT INTO public.schema_version (version) VALUES (160) ON CONFLICT DO NOTHING;
