-- =============================================================================
-- Migration 002: Auth Core (Roles, Permissions, Profiles)
-- =============================================================================
-- Purpose: Set up the auth/permission backbone of the system
-- Dependencies: 001_setup.sql, Supabase auth schema
-- =============================================================================

-- =============================================================================
-- Table: roles (lookup)
-- =============================================================================
-- 4 default roles: admin, senior_advisor, junior_advisor, secretary
-- Admin can create custom roles from settings UI
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_key ON public.roles(key);
CREATE INDEX IF NOT EXISTS idx_roles_active ON public.roles(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Seed default roles
INSERT INTO public.roles (key, name_he, name_en, sort_order, is_system) VALUES
  ('admin', 'מנהל', 'Admin', 1, TRUE),
  ('senior_advisor', 'יועץ בכיר', 'Senior Advisor', 2, FALSE),
  ('junior_advisor', 'יועץ זוטר', 'Junior Advisor', 3, FALSE),
  ('secretary', 'מזכירה', 'Secretary', 4, FALSE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Table: permissions (canonical list, code-aligned)
-- =============================================================================
-- Permission keys must match what the code checks via has_permission(key)
-- Adding new permissions = code change + insert here
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('view', 'financial', 'cases', 'leads', 'documents', 'system')),
  description_he TEXT,
  description_en TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Seed all permission keys (35 total)
INSERT INTO public.permissions (key, name_he, name_en, category) VALUES
  -- View permissions
  ('view_dashboard', 'גישה לדשבורד', 'Access Dashboard', 'view'),
  ('view_own_leads', 'לראות לידים שלי', 'View Own Leads', 'view'),
  ('view_all_leads', 'לראות כל הלידים', 'View All Leads', 'view'),
  ('view_own_cases', 'לראות תיקים שלי', 'View Own Cases', 'view'),
  ('view_all_cases', 'לראות כל התיקים', 'View All Cases', 'view'),
  ('view_archived_cases', 'לראות תיקים בארכיון', 'View Archived Cases', 'view'),
  ('view_case_documents', 'לראות מסמכים בתיק', 'View Case Documents', 'view'),
  ('view_case_obligations', 'לראות התחייבויות', 'View Case Obligations', 'view'),
  ('view_case_incomes', 'לראות הכנסות', 'View Case Incomes', 'view'),
  ('view_audit_log', 'לראות יומן שינויים', 'View Audit Log', 'view'),

  -- Financial permissions
  ('view_case_fee', 'לראות שכ"ט פר תיק', 'View Case Fee', 'financial'),
  ('view_expected_income', 'לראות הכנסה צפויה', 'View Expected Income', 'financial'),
  ('view_financial_dashboard', 'לראות דשבורד פיננסי', 'View Financial Dashboard', 'financial'),
  ('view_financial_reports', 'לראות דוחות פיננסיים', 'View Financial Reports', 'financial'),
  ('export_financial_data', 'לייצא נתונים פיננסיים', 'Export Financial Data', 'financial'),

  -- Case permissions
  ('create_case', 'ליצור תיק', 'Create Case', 'cases'),
  ('edit_own_case', 'לערוך תיק שלי', 'Edit Own Case', 'cases'),
  ('edit_any_case', 'לערוך כל תיק', 'Edit Any Case', 'cases'),
  ('delete_case', 'למחוק תיק', 'Delete Case', 'cases'),
  ('archive_case', 'לארכב תיק', 'Archive Case', 'cases'),
  ('restore_archived_case', 'לשחזר מארכיון', 'Restore Archived Case', 'cases'),
  ('convert_lead_to_case', 'להמיר ליד ללקוח', 'Convert Lead to Case', 'cases'),
  ('assign_case_to_user', 'להקצות תיק ליועץ', 'Assign Case to User', 'cases'),
  ('change_case_status', 'לשנות סטטוס תיק', 'Change Case Status', 'cases'),

  -- Lead permissions
  ('create_lead', 'ליצור ליד', 'Create Lead', 'leads'),
  ('edit_lead', 'לערוך ליד', 'Edit Lead', 'leads'),
  ('delete_lead', 'למחוק ליד', 'Delete Lead', 'leads'),

  -- Document permissions
  ('upload_document', 'להעלות מסמך', 'Upload Document', 'documents'),
  ('delete_document', 'למחוק מסמך', 'Delete Document', 'documents'),
  ('verify_document', 'לאמת מסמך', 'Verify Document', 'documents'),

  -- System permissions
  ('manage_users', 'לנהל משתמשים', 'Manage Users', 'system'),
  ('manage_roles', 'לנהל תפקידים', 'Manage Roles', 'system'),
  ('manage_settings', 'לנהל הגדרות', 'Manage Settings', 'system'),
  ('manage_lookups', 'לערוך רשימות', 'Manage Lookups', 'system'),
  ('manage_document_requirements', 'לנהל דרישות מסמכים', 'Manage Document Requirements', 'system')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Table: role_permissions (junction)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Table: profiles (extends auth.users)
-- =============================================================================
-- Linked 1:1 with auth.users via id
-- New users get a default role of 'junior_advisor' (can be changed by admin)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  role_id UUID REFERENCES public.roles(id),
  language TEXT NOT NULL DEFAULT 'he' CHECK (language IN ('he', 'en')),
  google_calendar_connected BOOLEAN NOT NULL DEFAULT FALSE,
  google_calendar_refresh_token TEXT, -- encrypted at app layer
  dashboard_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create profile when auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Get the junior_advisor role as default (can be changed by admin)
  SELECT id INTO default_role_id FROM public.roles WHERE key = 'junior_advisor' LIMIT 1;

  INSERT INTO public.profiles (id, email, role_id)
  VALUES (NEW.id, NEW.email, default_role_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Table: user_permission_overrides
-- =============================================================================
-- Per-user permission exceptions (override role permissions)
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON public.user_permission_overrides(user_id);

CREATE TRIGGER trg_user_overrides_updated_at
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Function: has_permission(key TEXT) RETURNS BOOLEAN
-- =============================================================================
-- The core authorization check - used in RLS policies and app logic
-- Order: user override > role permission > false
CREATE OR REPLACE FUNCTION public.has_permission(perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_id UUID;
  has_override BOOLEAN;
  override_granted BOOLEAN;
  has_role_perm BOOLEAN;
BEGIN
  -- No user = no permissions
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get user's role
  SELECT p.role_id INTO user_role_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active = TRUE;

  -- Inactive user or no role
  IF user_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check user-level override first
  SELECT EXISTS(
    SELECT 1
    FROM public.user_permission_overrides uo
    JOIN public.permissions p ON p.id = uo.permission_id
    WHERE uo.user_id = auth.uid() AND p.key = perm_key
  ) INTO has_override;

  IF has_override THEN
    SELECT uo.is_granted INTO override_granted
    FROM public.user_permission_overrides uo
    JOIN public.permissions p ON p.id = uo.permission_id
    WHERE uo.user_id = auth.uid() AND p.key = perm_key;
    RETURN override_granted;
  END IF;

  -- Fall through to role permission
  SELECT EXISTS(
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = user_role_id
      AND p.key = perm_key
      AND rp.is_granted = TRUE
  ) INTO has_role_perm;

  RETURN COALESCE(has_role_perm, FALSE);
END;
$$;

-- =============================================================================
-- Function: is_admin() RETURNS BOOLEAN
-- =============================================================================
-- Quick check for admin role (used in management RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND r.key = 'admin'
  );
END;
$$;
