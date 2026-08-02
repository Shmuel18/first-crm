-- =============================================================================
-- Migration 226: the archive follows closed/frozen statuses
-- =============================================================================
-- Kaufman (31.7): moving a case to "נסגר" (closed) makes it invisible — it
-- leaves the active dashboard (the closed/frozen filter hides it) but never
-- reaches the archive, because only the explicit archive action ever set
-- cases.is_archived. His rule: closed or frozen → the case belongs in the
-- archive; from the archive, an explicit restore OR a status change back to an
-- active stage returns it to the active list.
--
-- Five pieces, one invariant (closed/on_hold ⇔ archived):
--   1. sync_case_archive_with_status(): BEFORE trigger deriving is_archived
--      from the status key on every status write (inline cell, full form,
--      import RPC, direct SQL). On INSERT it only forces TRUE (never FALSE),
--      so restore-from-backup keeps a manually archived active-status case
--      archived. NULL status counts as active (migration 223 convention).
--   2. get_restore_target_status(): the stage an explicit archive-restore
--      should land the case in — the last ACTIVE stage from stage_durations
--      (fallback 'case_opened'), NULL when the current status is already
--      active. Called by toggleArchiveAction; without it a restored closed
--      case would leave the archive yet stay hidden from the active list.
--   3. Backfill: archive every existing closed/on_hold case (the "limbo" rows
--      Kaufman reported). Runs as postgres → the 178 permission guard skips,
--      audit rows get user_id NULL (column is nullable).
--   4. get_statistics_summary(): the status snapshot now counts closed/frozen
--      cases REGARDLESS of is_archived — Kaufman: "לא רואים בסטטיסטיקות מה
--      שנסגר". Until now archiving a closed case erased it from the pipeline
--      snapshot; with auto-archive the closed count would have pinned to 0.
--   5. collections_overview(): archived cases with an OUTSTANDING balance stay
--      on the /collections dashboard. The old blanket is_archived = FALSE
--      filter would otherwise drop every frozen/closed case the moment the
--      trigger fires — hiding money the office is still owed (freezing is not
--      payment). Settled archived cases still drop off.
--
-- Companion TS change (same commit): the SLA cron's archived-case skip now
-- exempts 'on_hold' overdue rows — frozen cases live in the archive by design,
-- and the configurable "frozen too long" alert must keep firing for them.
--
-- Permission note (deliberate): a user with change_case_status can now archive
-- or un-archive by changing status, without archive_case/restore_archived_case.
-- Closing IS archiving under the new model; the explicit archive permissions
-- still gate the standalone archive/restore actions.
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS + guarded backfill).
-- Dependencies: 004/082/225 (status keys), 006 (cases), 009 (stage_durations),
-- 106/147 (can_edit_case), 178 (trusted-columns guard), 191 (summary body —
-- restated below with only the status_snapshot subquery changed), 223 (active
-- semantics).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Derive is_archived from the status on every status write
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_case_archive_with_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NEW.status_id IS NULL THEN
    -- NULL status is "active" (migration 223): clearing the status pulls the
    -- case out of the archive. On INSERT there is nothing to derive.
    IF TG_OP = 'UPDATE' THEN
      NEW.is_archived := FALSE;
    END IF;
    RETURN NEW;
  END IF;

  SELECT s.key INTO v_key FROM public.case_statuses s WHERE s.id = NEW.status_id;

  IF v_key IN ('closed', 'on_hold') THEN
    NEW.is_archived := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status moved to an active stage → the case jumps back out of the
    -- archive ("משנה שלב בתהליך ואז קופץ בחזרה לבד לתיקים פעילים").
    -- INSERT keeps the provided is_archived so restore-from-backup preserves
    -- manually archived active-status cases.
    NEW.is_archived := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_case_archive_with_status() IS
  'Keeps cases.is_archived in lockstep with the status: closed/on_hold → '
  'archived, any active stage (on UPDATE) → un-archived. See migration 226.';

DROP TRIGGER IF EXISTS trg_cases_archive_follows_status_ins ON public.cases;
CREATE TRIGGER trg_cases_archive_follows_status_ins
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  WHEN (NEW.status_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_case_archive_with_status();

DROP TRIGGER IF EXISTS trg_cases_archive_follows_status_upd ON public.cases;
CREATE TRIGGER trg_cases_archive_follows_status_upd
  BEFORE UPDATE OF status_id ON public.cases
  FOR EACH ROW
  WHEN (NEW.status_id IS DISTINCT FROM OLD.status_id)
  EXECUTE FUNCTION public.sync_case_archive_with_status();

-- -----------------------------------------------------------------------------
-- 2. Which stage should an explicit archive-restore land the case in?
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so the history lookup works under the EDIT gate regardless
-- of the caller's per-case child-RLS visibility (stage_durations SELECT is
-- can_view_case-scoped, migration 039). Gated on can_edit_case: it reveals
-- nothing about cases the caller couldn't already edit.
CREATE OR REPLACE FUNCTION public.get_restore_target_status(p_case_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_current_key TEXT;
  v_target UUID;
BEGIN
  IF NOT public.can_edit_case(p_case_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT s.key INTO v_current_key
    FROM public.cases c
    JOIN public.case_statuses s ON s.id = c.status_id
   WHERE c.id = p_case_id;

  -- Already in an active stage (or no status): restore keeps it as-is.
  IF v_current_key IS NULL OR v_current_key NOT IN ('closed', 'on_hold') THEN
    RETURN NULL;
  END IF;

  -- The most recent ACTIVE stage in the case's history.
  SELECT sd.status_id INTO v_target
    FROM public.stage_durations sd
    JOIN public.case_statuses s ON s.id = sd.status_id
   WHERE sd.case_id = p_case_id
     AND s.key NOT IN ('closed', 'on_hold')
   -- entered_at is NOW()-stamped, so stages walked inside ONE transaction tie;
   -- ctid breaks the tie by physical insertion order (good enough for a
   -- same-instant history, which no app path produces anyway).
   ORDER BY sd.entered_at DESC, sd.ctid DESC
   LIMIT 1;

  -- No active history (e.g. imported directly as closed): restart the case
  -- rather than leave it invisible in both views.
  IF v_target IS NULL THEN
    SELECT id INTO v_target FROM public.case_statuses WHERE key = 'case_opened';
  END IF;

  RETURN v_target;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_restore_target_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restore_target_status(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_restore_target_status(UUID) IS
  'Stage an archive-restore should return the case to: last active stage from '
  'stage_durations (fallback case_opened); NULL when the current status is '
  'already active. can_edit_case-gated. See migration 226.';

-- -----------------------------------------------------------------------------
-- 3. Backfill: existing closed/frozen cases move into the archive
-- -----------------------------------------------------------------------------
UPDATE public.cases c
   SET is_archived = TRUE
  FROM public.case_statuses s
 WHERE s.id = c.status_id
   AND s.key IN ('closed', 'on_hold')
   AND c.is_archived = FALSE;

-- -----------------------------------------------------------------------------
-- 4. Statistics: closed/frozen counts survive archiving
-- -----------------------------------------------------------------------------
-- Restates the migration-191 body; ONLY the status_snapshot subquery changed
-- (closed/on_hold counted regardless of is_archived).
CREATE OR REPLACE FUNCTION public.get_statistics_summary(
  p_period TEXT DEFAULT 'this_month',
  p_from   DATE DEFAULT NULL,
  p_to     DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from TIMESTAMPTZ;
  v_to   TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Anchor: start of the current Asia/Jerusalem calendar month, as an instant.
  v_month_start := timezone(
    'Asia/Jerusalem',
    date_trunc('month', timezone('Asia/Jerusalem', now()))
  );

  IF p_period = 'custom' AND p_from IS NOT NULL AND p_to IS NOT NULL AND p_from <= p_to THEN
    -- Inclusive [from, to] interpreted as Israel-local calendar days.
    v_from := timezone('Asia/Jerusalem', p_from::timestamp);
    v_to   := timezone('Asia/Jerusalem', (p_to + 1)::timestamp);
  ELSE
    CASE p_period
      WHEN 'last_month' THEN
        v_from := v_month_start - INTERVAL '1 month';
        v_to   := v_month_start;
      WHEN 'last_3_months' THEN
        v_from := v_month_start - INTERVAL '2 months';
        v_to   := v_month_start + INTERVAL '1 month';
      WHEN 'this_year' THEN
        v_from := timezone('Asia/Jerusalem', date_trunc('year', timezone('Asia/Jerusalem', now())));
        v_to   := v_from + INTERVAL '1 year';
      ELSE
        -- 'this_month' (default / custom-without-valid-range / unrecognized)
        v_from := v_month_start;
        v_to   := v_month_start + INTERVAL '1 month';
    END CASE;
  END IF;

  RETURN (
    WITH es AS (
      SELECT id FROM public.case_statuses WHERE key = 'execution'
    ),
    -- Cases that ENTERED execution within the period (distinct case; first
    -- entry in the window if it bounced). Soft-deleted cases excluded.
    executed AS (
      SELECT sd.case_id, MIN(sd.entered_at) AS executed_at
        FROM public.stage_durations sd
        JOIN es ON sd.status_id = es.id
        JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
       WHERE sd.entered_at >= v_from AND sd.entered_at < v_to
       GROUP BY sd.case_id
    )
    SELECT jsonb_build_object(
      'period', jsonb_build_object('from', v_from, 'to', v_to),
      'kpis', jsonb_build_object(
        'active_cases', (
          SELECT COUNT(*) FROM public.cases
           WHERE deleted_at IS NULL AND is_archived = FALSE
        ),
        'opened_in_period', (
          SELECT COUNT(*) FROM public.cases
           WHERE deleted_at IS NULL
             AND created_at >= v_from AND created_at < v_to
        ),
        'executed_in_period', (SELECT COUNT(*) FROM executed),
        'stuck_cases', (
          SELECT COUNT(*)
            FROM public.cases c
            JOIN public.case_statuses s ON s.id = c.status_id
           WHERE c.deleted_at IS NULL AND c.is_archived = FALSE
             AND s.key = 'stuck'
        ),
        'avg_cycle_days', (
          SELECT ROUND(
                   AVG(EXTRACT(EPOCH FROM (e.executed_at - c.created_at)) / 86400)::numeric,
                   1
                 )
            FROM executed e
            JOIN public.cases c ON c.id = e.case_id
        ),
        'leads_converted_in_period', (
          SELECT COUNT(*) FROM public.leads
           WHERE status = 'converted'
             AND converted_at >= v_from AND converted_at < v_to
        )
      ),
      -- Snapshot of the whole book: active stages count the live (non-archived)
      -- pipeline; closed/on_hold count EVERY non-deleted case — those live in
      -- the archive by design (migration 226), and archiving must not erase
      -- them from the statistics.
      'status_snapshot', (
        SELECT COALESCE(
                 jsonb_agg(
                   jsonb_build_object(
                     'key', s.key,
                     'name_he', s.name_he,
                     'name_en', s.name_en,
                     'color', s.color,
                     'sort_order', s.sort_order,
                     'count', COALESCE(cc.n, 0)
                   ) ORDER BY s.sort_order
                 ),
                 '[]'::jsonb
               )
          FROM public.case_statuses s
          LEFT JOIN (
            SELECT c.status_id, COUNT(*) AS n
              FROM public.cases c
              LEFT JOIN public.case_statuses k ON k.id = c.status_id
             WHERE c.deleted_at IS NULL
               AND (c.is_archived = FALSE OR k.key IN ('closed', 'on_hold'))
             GROUP BY c.status_id
          ) cc ON cc.status_id = s.id
         WHERE s.is_active = TRUE
      ),
      -- Per-advisor: active load + deals executed in the period. Only advisors
      -- with some activity are returned (keeps the table free of idle staff).
      'by_advisor', (
        SELECT COALESCE(jsonb_agg(sub.obj ORDER BY sub.first_name), '[]'::jsonb)
          FROM (
            SELECT jsonb_build_object(
                     'advisor_id', p.id,
                     'first_name', p.first_name,
                     'last_name', p.last_name,
                     'active_cases', COALESCE(ac.n, 0),
                     'executed_in_period', COALESCE(ec.n, 0)
                   ) AS obj,
                   p.first_name
              FROM public.profiles p
              LEFT JOIN (
                SELECT assigned_advisor_id, COUNT(*) AS n
                  FROM public.cases
                 WHERE deleted_at IS NULL AND is_archived = FALSE
                 GROUP BY assigned_advisor_id
              ) ac ON ac.assigned_advisor_id = p.id
              LEFT JOIN (
                SELECT c.assigned_advisor_id, COUNT(*) AS n
                  FROM executed e
                  JOIN public.cases c ON c.id = e.case_id
                 GROUP BY c.assigned_advisor_id
              ) ec ON ec.assigned_advisor_id = p.id
             WHERE p.is_active = TRUE
               AND (COALESCE(ac.n, 0) > 0 OR COALESCE(ec.n, 0) > 0)
          ) sub
      ),
      'financial', jsonb_build_object(
        'active_loan_volume', (
          SELECT COALESCE(SUM(requested_mortgage_amount), 0)
            FROM public.cases
           WHERE deleted_at IS NULL AND is_archived = FALSE
        ),
        -- Forward pipeline: agreed fee across the whole ACTIVE book — "what's
        -- expected to come in". Mirrors active_loan_volume (Kaufman request).
        'active_fee_total', (
          SELECT COALESCE(SUM(cf.fee_amount), 0)
            FROM public.cases c
            JOIN public.case_financials cf ON cf.case_id = c.id
           WHERE c.deleted_at IS NULL AND c.is_archived = FALSE
        ),
        'executed_fee_total', (
          SELECT COALESCE(SUM(cf.fee_amount), 0)
            FROM executed e
            JOIN public.case_financials cf ON cf.case_id = e.case_id
        ),
        -- Commissions/salaries (migration 186) paid out of the executed cases'
        -- fees. NET fee = executed_fee_total − this; derived in the UI.
        'executed_payout_total', (
          SELECT COALESCE(SUM(cp.amount), 0)
            FROM executed e
            JOIN public.case_payouts cp ON cp.case_id = e.case_id AND cp.deleted_at IS NULL
        ),
        'executed_expected_income_total', (
          SELECT COALESCE(SUM(cf.expected_income), 0)
            FROM executed e
            JOIN public.case_financials cf ON cf.case_id = e.case_id
        )
      )
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_statistics_summary(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statistics_summary(TEXT, DATE, DATE) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Collections: outstanding balances survive archiving
-- -----------------------------------------------------------------------------
-- Restates the migration-212 body; ONLY the WHERE changed. The blanket
-- is_archived = FALSE became: non-archived as before, OR archived but still
-- OWED money. "Owed" mirrors the shared TS balance helpers
-- (src/features/collections/domain/collections-calc.ts): payments cover
-- expenses first, then the fee-due (full fee at execution, else the advance
-- capped by the fee) — outstanding > 0 ⇔ collected < expenses + fee_due_now.
CREATE OR REPLACE FUNCTION public.collections_overview()
RETURNS TABLE (
  case_id             UUID,
  case_number         TEXT,
  borrowers           TEXT,
  assigned_advisor_id UUID,
  case_status         TEXT,
  fee_amount          NUMERIC,
  advance_agreed      BOOLEAN,
  advance_amount      NUMERIC,
  collected           NUMERIC,
  expenses            NUMERIC,
  payment_count       BIGINT,
  last_payment_on     DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('view_collections') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.case_number,
    (
      SELECT STRING_AGG(
               TRIM(BOTH ' ' FROM b.first_name || ' ' || COALESCE(b.last_name, '')),
               ', ' ORDER BY cb.is_primary DESC, b.first_name
             )
        FROM public.case_borrowers cb
        JOIN public.borrowers b ON b.id = cb.borrower_id AND b.deleted_at IS NULL
       WHERE cb.case_id = c.id
    ) AS borrowers,
    c.assigned_advisor_id,
    cs.key AS case_status,
    cf.fee_amount,
    COALESCE(cf.advance_agreed, FALSE),
    cf.advance_amount,
    COALESCE(p.collected,  0)::numeric,
    COALESCE(e.expenses,   0)::numeric,
    COALESCE(p.payment_count, 0)::bigint,
    p.last_payment_on
  FROM public.cases c
  LEFT JOIN public.case_statuses cs ON cs.id = c.status_id
  LEFT JOIN public.case_financials cf ON cf.case_id = c.id
  LEFT JOIN (
    SELECT fp.case_id      AS cid,
           SUM(fp.amount)  AS collected,
           COUNT(*)        AS payment_count,
           MAX(fp.paid_on) AS last_payment_on
      FROM public.case_fee_payments fp
     WHERE fp.deleted_at IS NULL
     GROUP BY fp.case_id
  ) p ON p.cid = c.id
  LEFT JOIN (
    SELECT ex.case_id     AS cid,
           SUM(ex.amount) AS expenses
      FROM public.case_expenses ex
     WHERE ex.deleted_at IS NULL
     GROUP BY ex.case_id
  ) e ON e.cid = c.id
  WHERE c.deleted_at  IS NULL
    AND (
      COALESCE(cf.advance_amount, 0) > 0
      OR COALESCE(e.expenses,     0) > 0
      OR cs.key = 'execution'
    )
    AND (
      c.is_archived = FALSE
      -- Archived (auto-archived closed/frozen since this migration, or
      -- manually archived) cases stay listed while money is outstanding.
      OR COALESCE(p.collected, 0) < COALESCE(e.expenses, 0)
         + CASE WHEN cs.key = 'execution'
                THEN COALESCE(cf.fee_amount, 0)
                ELSE LEAST(GREATEST(COALESCE(cf.advance_amount, 0), 0),
                           COALESCE(cf.fee_amount, 0))
           END
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.collections_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collections_overview() TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (226) ON CONFLICT DO NOTHING;
