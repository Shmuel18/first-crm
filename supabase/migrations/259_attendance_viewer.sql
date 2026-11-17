-- 259 — attendance viewer: see the time clock, nothing else.
--
-- Kaufman wants the office's second manager (Spitzer) to see who is on the
-- clock right now and every tracked employee's hours history — like he does —
-- but NOT wages, NOT edit shifts, NOT flag employees. Migration 241 put the
-- whole time clock behind is_owner, and is_owner also unlocks ma'aser, backup
-- and wages, so it cannot simply be granted.
--
-- New flag profiles.can_view_attendance → READ-ONLY attendance:
--   * time_entries SELECT widens to can_view_attendance() (owner OR flag);
--     INSERT/UPDATE/soft-delete stay owner-only (policies untouched).
--   * employee_pay_rates is untouched (self-or-owner) — the viewer sees no wage.
--   * Only the owner (or SQL) can change the flag: same guard trigger as
--     time_tracked, so the viewer cannot grant it to anyone else.
--
-- Note: reading the staff list goes through profiles RLS (self-or-admin, mig
-- 145). The intended viewer is an admin, so that holds; a non-admin given the
-- flag would see the clock but an empty staff list — deliberately NOT widened.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_view_attendance BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.can_view_attendance IS
  'Read-only access to every tracked employee''s attendance (live board + '
  'hours history). No wages, no edits. Owner-only to change (mig 259).';

-- -----------------------------------------------------------------------------
-- 1. The read gate: owner, or a flagged viewer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_attendance()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN public.is_owner() OR EXISTS(
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.is_active = TRUE
       AND p.can_view_attendance
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.can_view_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_attendance() TO authenticated;

DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.can_view_attendance()));

-- -----------------------------------------------------------------------------
-- 2. Guard: the flag moves only by the owner (or SQL). Body = mig 242 + the
--    new column beside the time-clock flags.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_owner_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
    RAISE EXCEPTION 'is_owner cannot be changed through the API'
      USING ERRCODE = '42501';
  END IF;

  IF (OLD.is_protected OR OLD.is_owner) AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;

  IF (NEW.time_tracked        IS DISTINCT FROM OLD.time_tracked
   OR NEW.auto_clock_in       IS DISTINCT FROM OLD.auto_clock_in
   OR NEW.can_view_attendance IS DISTINCT FROM OLD.can_view_attendance)
   AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'time-clock fields are owner-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON TABLE public.time_entries IS
  'Attendance shifts for hourly staff. Employee reads/closes their own; the '
  'office OWNER (is_owner, mig 241) sees and edits all; a can_view_attendance '
  'viewer (mig 259) reads all, edits none. Soft-delete via RPC.';

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (259) ON CONFLICT DO NOTHING;
