-- =============================================================================
-- Migration 225: new pipeline stage "הוצא לבחינה" (sent for review)
-- =============================================================================
-- Kaufman: add a stage named הוצא לבחינה, positioned right before ביצוע
-- (execution) — the file has left the office for the bank's final examination
-- but execution has not started yet.
--
-- Statuses are DB data (case_statuses), so no code change is needed: the
-- dashboard stage filter, the status pills, the settings palette, statistics'
-- pipeline chart and stage_durations all key off this table. Key-based logic
-- in code ('closed'/'on_hold' → frozen, 'execution' → collections) is
-- untouched — the new stage is an ACTIVE, non-terminal step.
--
-- Placement: shift every status at execution's slot and later down by one,
-- then insert the new row into execution's old slot. sort_order has no unique
-- constraint (idx only), so the single-statement shift is safe; admin-created
-- custom statuses in that range keep their relative order.
--
-- Color: fuchsia-700 #A21CAF — follows the migration-082 palette rule
-- (Tailwind 600-800 saturation), distinct from execution's purple-700 and
-- submitted_to_bank's blue-700.
--
-- Idempotent (guarded by the key existence check). Deps: 003, 004, 082.
-- =============================================================================

DO $$
DECLARE
  v_exec_sort INT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.case_statuses WHERE key = 'sent_for_review') THEN
    RETURN;
  END IF;

  SELECT sort_order INTO v_exec_sort
    FROM public.case_statuses
   WHERE key = 'execution';
  IF v_exec_sort IS NULL THEN
    RAISE EXCEPTION 'migration 225: execution status not found';
  END IF;

  UPDATE public.case_statuses
     SET sort_order = sort_order + 1
   WHERE sort_order >= v_exec_sort;

  INSERT INTO public.case_statuses
    (key, name_he, name_en, color, sort_order, is_terminal, is_system)
  VALUES
    ('sent_for_review', 'הוצא לבחינה', 'Sent for Review', '#A21CAF', v_exec_sort, FALSE, TRUE);
END;
$$;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (225) ON CONFLICT DO NOTHING;
