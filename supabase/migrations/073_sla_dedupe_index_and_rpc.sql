-- =============================================================================
-- Migration 073: Atomic dedupe for SLA overdue notifications
-- =============================================================================
-- Review findings #5, #6, #9 — the SLA cron's TS-side dedupe is a
-- read-then-write race (two concurrent runs both pass the dedupe SELECT
-- and both INSERT), the dedupe key was missing user_id (so a new admin
-- never got backfill alerts), and the bulk INSERT was atomic — any FK
-- violation rejected the whole batch.
--
-- This migration introduces:
--
--   1. A partial UNIQUE INDEX on notifications for the overdue-alert
--      dedupe key (user_id, case_id, data->>'enteredAt') WHERE type =
--      'case_status_overdue'. This is the constraint that ON CONFLICT
--      DO NOTHING infers — concurrent inserts now race-safely collapse
--      into one row per (recipient, case, enter-instant).
--
--   2. insert_overdue_notifications(p_rows JSONB) — a SECURITY DEFINER
--      RPC that does ONE bulk INSERT with ON CONFLICT DO NOTHING.
--      Returns the count of rows actually inserted (excluding dupes).
--      Replaces the TS bulk insert; failures on a single row's FK no
--      longer reject the whole batch — those rows are dropped at the
--      RPC level via a per-row error-skipping pattern.
-- =============================================================================

-- ── 1. Partial unique index for the overdue dedupe key ────────────────
-- Including user_id in the dedupe key fixes finding #6: a new admin
-- added between cron runs gets backfill alerts because they have no
-- prior row for the (case, enter-instant) pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_overdue_dedupe
  ON public.notifications (user_id, case_id, ((data->>'enteredAt')))
  WHERE type = 'case_status_overdue';

-- ── 2. RPC: atomic insert + race-safe dedupe ──────────────────────────
-- Splits the batch into per-row inserts inside a single transaction so
-- one bad FK doesn't reject the rest. ON CONFLICT DO NOTHING handles the
-- race window (two cron invocations both inserting). Returns the count
-- actually inserted so the caller can report it.
CREATE OR REPLACE FUNCTION public.insert_overdue_notifications(p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_inserted INT := 0;
  r JSONB;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array' USING ERRCODE = '22023';
  END IF;

  -- Iterate per-row so a single FK violation doesn't abort the batch.
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, case_id, data)
      VALUES (
        (r->>'user_id')::UUID,
        r->>'type',
        (r->>'case_id')::UUID,
        r->'data'
      )
      ON CONFLICT (user_id, case_id, ((data->>'enteredAt')))
        WHERE type = 'case_status_overdue'
        DO NOTHING;
      -- Row was inserted only if there's no conflict and no exception.
      -- ROW_COUNT distinguishes insert (1) from conflict-skip (0).
      v_inserted := v_inserted + COALESCE(
        (SELECT 1 WHERE FOUND), 0
      );
    EXCEPTION
      WHEN foreign_key_violation OR unique_violation OR check_violation THEN
        -- Skip the row, log nothing here (the caller can compare returned
        -- count to input length to detect the gap). Other exceptions
        -- bubble up so a real bug isn't silently swallowed.
        NULL;
    END;
  END LOOP;

  RETURN v_inserted;
END;
$fn$;

-- service_role + the cron-only path can call this. Don't grant to
-- authenticated — non-service callers should never write notifications
-- directly (the table has no INSERT RLS route).
GRANT EXECUTE ON FUNCTION public.insert_overdue_notifications(JSONB) TO service_role;
