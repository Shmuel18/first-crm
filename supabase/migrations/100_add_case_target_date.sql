-- Manual case-level target date for advisor prioritization.
-- Nullable by design: many cases do not yet have a committed deadline.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS target_date DATE;

COMMENT ON COLUMN public.cases.target_date IS
  'Manual case target date set by the advisor; not derived from SLA or task due dates.';
