-- Admin-managed overrides for automatic system emails. Defaults remain in code,
-- so transactional mail continues to work when a row does not exist.
CREATE TABLE IF NOT EXISTS public.system_email_templates (
  template_key TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('he', 'en')),
  subject TEXT NOT NULL,
  heading TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id),
  PRIMARY KEY (template_key, locale)
);

CREATE TRIGGER trg_system_email_templates_updated_at
  BEFORE UPDATE ON public.system_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.system_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_email_templates_admin_all ON public.system_email_templates;
CREATE POLICY system_email_templates_admin_all ON public.system_email_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.schema_version (version) VALUES (162) ON CONFLICT DO NOTHING;
