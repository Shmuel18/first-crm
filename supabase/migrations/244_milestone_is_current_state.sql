-- =============================================================================
-- Migration 244: ביצוע is a state, not a permanent achievement
-- =============================================================================
-- Kaufman: case 2026-003 (פרלמן) has never been to ביצוע, yet the מנהלה block
-- read "הגיע לביצוע ב-27/07". The history explains it:
--
--   10/06 20:24 → 27/07 06:04   בטחונות
--   27/07 06:04 → 27/07 06:05   ביצוע      ← 42 seconds
--   27/07 06:05 → 29/07 19:08   בטחונות
--   29/07 19:08 → 29/07 19:08   ביצוע      ← 8 seconds
--   29/07 19:08 → (open)        בטחונות
--
-- Somebody picked ביצוע by mistake and undid it moments later. stage_durations
-- recorded both, and migration 243 took MIN(entered_at) over EVERY execution
-- row — so a 42-second slip became the case's execution date, and the case was
-- counted in July's בוצעו, in avg_cycle_days and in the histogram.
--
-- THE RULE, Kaufman's own framing: a case enters ביצוע when you set ביצוע and
-- leaves when you set it back. It counts only while it is still there (or at
-- בוצע ושולם), and its date is where the CURRENT unbroken run of those two
-- stages began. Nothing is measured by how long a click lasted, so there is no
-- threshold to tune and no magic number to defend.
--
-- Consequences, measured on production: 40 counted cases become 35.
--   * פרלמן and three others drop out — every one of their ביצוע visits was
--     under 90 seconds and reverted.
--   * Case 2026-074 also drops. It sat in ביצוע for 27.8 real days and then
--     genuinely returned to בטחונות. Under this rule that is correct: it is
--     not in ביצוע, so it has not executed. (The rejected alternative was a
--     minimum-dwell rule, which would have kept it at 36.)
--   * A case that slipped once and later reached ביצוע for real reports the
--     REAL date: the earlier visit is not part of the current run.
--
-- The trade-off Kaufman accepted: past months are no longer frozen. Move a
-- July case back out of ביצוע and July's בוצעו drops by one. That follows from
-- treating it as a state — if it is not executed now, it did not execute.
--
-- 35 is also exactly the "סה״כ הושלמו" figure in the pipeline snapshot, so the
-- two screens now agree by construction rather than by coincidence.
--
-- The TS side applies the identical rule in cases/domain/cycle-time.ts, so the
-- case page and the statistics page cannot disagree.
--
-- Idempotent, no schema change — both bodies are migration 243's with only the
-- milestone CTE replaced. stage_breakdown is deliberately untouched: its
-- sub-minute visits are real visits under this rule, and filtering them would
-- smuggle back the threshold this migration just removed. Deps: 243.
-- =============================================================================

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
    -- ביצוע AND בוצע ושולם both count as "the deal happened" (migration 243).
    -- 'closed' is downstream of 'execution', so a case that passed through
    -- both must resolve to the EARLIER instant — hence one all-time MIN per
    -- case in `milestone`, windowed afterwards in `executed`.
    WITH es AS (
      SELECT id FROM public.case_statuses WHERE key IN ('execution', 'closed')
    ),
    -- One row per case: the first time it EVER reached the milestone.
    -- Soft-deleted cases excluded; archived ones deliberately kept (a
    -- completed deal is archived by design — migrations 226/227).
    -- Every stage row per case, newest first, flagged as milestone or not.
    hist AS (
      SELECT sd.case_id, sd.entered_at,
             (sd.status_id IN (SELECT id FROM es)) AS is_ms,
             ROW_NUMBER() OVER (PARTITION BY sd.case_id ORDER BY sd.entered_at DESC) AS rn_desc
        FROM public.stage_durations sd
        JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
    ),
    -- The case counts only while it is STILL at ביצוע / בוצע ושולם, and the
    -- date is where its CURRENT unbroken run of those stages began.
    -- `first_break` is the position of the newest non-milestone row: rows
    -- newer than it (rn_desc < first_break) are the trailing run. If the
    -- newest row of all is not a milestone, first_break = 1 and nothing
    -- qualifies — the case has left ביצוע and drops out, which is the point.
    -- NULL first_break means the case has never been anywhere else.
    milestone AS (
      SELECT case_id, MIN(entered_at) AS reached_at
        FROM (
          SELECT h.*,
                 MIN(CASE WHEN NOT h.is_ms THEN h.rn_desc END)
                   OVER (PARTITION BY h.case_id) AS first_break
            FROM hist h
        ) x
       WHERE x.is_ms AND (x.first_break IS NULL OR x.rn_desc < x.first_break)
       GROUP BY case_id
    ),
    -- Cases whose (single, all-time) milestone lands inside the period.
    executed AS (
      SELECT m.case_id, m.reached_at AS executed_at
        FROM milestone m
       WHERE m.reached_at >= v_from AND m.reached_at < v_to
    ),
    -- Days from opening to milestone, for every case that ever got there.
    -- Un-windowed: this is the population the cycle_time survey describes.
    cycle AS (
      SELECT EXTRACT(
               EPOCH FROM (
                 m.reached_at
                 - COALESCE(timezone('Asia/Jerusalem', c.opened_at::timestamp), c.created_at)
               )
             ) / 86400 AS days
        FROM milestone m
        JOIN public.cases c ON c.id = m.case_id
    )
    SELECT jsonb_build_object(
      'period', jsonb_build_object('from', v_from, 'to', v_to),
      'kpis', jsonb_build_object(
        'active_cases', (
          SELECT COUNT(*) FROM public.cases
           WHERE deleted_at IS NULL AND is_archived = FALSE
        ),
        -- Counts by the REAL opening date (opened_at when set) so a corrected
        -- legacy case lands in the month it was actually opened.
        'opened_in_period', (
          SELECT COUNT(*) FROM public.cases c
           WHERE c.deleted_at IS NULL
             AND COALESCE(timezone('Asia/Jerusalem', c.opened_at::timestamp), c.created_at) >= v_from
             AND COALESCE(timezone('Asia/Jerusalem', c.opened_at::timestamp), c.created_at) <  v_to
        ),
        'executed_in_period', (SELECT COUNT(*) FROM executed),
        -- Every stuck case is archived (migration 227), so no is_archived
        -- predicate here — it would pin the KPI to 0.
        'stuck_cases', (
          SELECT COUNT(*)
            FROM public.cases c
            JOIN public.case_statuses s ON s.id = c.status_id
           WHERE c.deleted_at IS NULL
             AND s.key = 'stuck'
        ),
        'avg_cycle_days', (
          SELECT ROUND(
                   AVG(
                     EXTRACT(
                       EPOCH FROM (
                         e.executed_at
                         - COALESCE(timezone('Asia/Jerusalem', c.opened_at::timestamp), c.created_at)
                       )
                     ) / 86400
                   )::numeric,
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
      -- "כמה זמן אורך תיק" — the distribution behind the average. Fixed
      -- buckets rather than percentiles: Kaufman reads this as "how many of
      -- my files close inside a month / drag past half a year". Un-windowed,
      -- so the shape is stable regardless of the period selector; the UI says
      -- so explicitly. A negative value (opened_at typed later than the
      -- execution date) falls into the first bucket — it is a data-entry
      -- error, not a category worth its own bar.
      'cycle_time', (
        SELECT jsonb_build_object(
          'n', (SELECT COUNT(*) FROM cycle),
          'avg_days', (SELECT ROUND(AVG(days)::numeric, 1) FROM cycle),
          'buckets', jsonb_build_array(
            jsonb_build_object('key', 'lt_30',
              'count', (SELECT COUNT(*) FROM cycle WHERE days < 30)),
            jsonb_build_object('key', 'd30_60',
              'count', (SELECT COUNT(*) FROM cycle WHERE days >= 30 AND days < 60)),
            jsonb_build_object('key', 'd60_90',
              'count', (SELECT COUNT(*) FROM cycle WHERE days >= 60 AND days < 90)),
            jsonb_build_object('key', 'd90_180',
              'count', (SELECT COUNT(*) FROM cycle WHERE days >= 90 AND days < 180)),
            jsonb_build_object('key', 'gte_180',
              'count', (SELECT COUNT(*) FROM cycle WHERE days >= 180))
          )
        )
      ),
      -- Average days spent in each stage, over COMPLETED stage visits only
      -- (exited_at IS NOT NULL — an open stage has no duration yet). Shows
      -- where the pipeline actually loses time. `n` is the number of completed
      -- visits, not distinct cases: a case that re-enters a stage contributes
      -- each visit, which is the honest denominator for "time per visit".
      'stage_breakdown', (
        SELECT COALESCE(
                 jsonb_agg(
                   jsonb_build_object(
                     'key', s.key,
                     'name_he', s.name_he,
                     'name_en', s.name_en,
                     'color', s.color,
                     'sort_order', s.sort_order,
                     'avg_days', ROUND(sb.avg_days::numeric, 1),
                     'n', sb.n
                   ) ORDER BY s.sort_order
                 ),
                 '[]'::jsonb
               )
          FROM (
            SELECT sd.status_id,
                   AVG(EXTRACT(EPOCH FROM (sd.exited_at - sd.entered_at)) / 86400) AS avg_days,
                   COUNT(*) AS n
              FROM public.stage_durations sd
              JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
             WHERE sd.exited_at IS NOT NULL
             GROUP BY sd.status_id
          ) sb
          JOIN public.case_statuses s ON s.id = sb.status_id
         WHERE s.is_active = TRUE
      ),
      -- Snapshot of the whole book: active stages count the live (non-archived)
      -- pipeline; closed/on_hold/stuck count EVERY non-deleted case — those
      -- live in the archive by design (migrations 226/227), and archiving must
      -- not erase them from the statistics.
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
               AND (c.is_archived = FALSE OR k.key IN ('closed', 'on_hold', 'stuck'))
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
-- 3. get_statistics_monthly_trend — same milestone + opened_at anchor
-- -----------------------------------------------------------------------------
-- Body restated from migration 135 (never replaced since). Two changes, both
-- described in the header: the milestone status set, and bucketing `opened` by
-- the real opening date. `executed` counts one row per case (milestone is
-- already unique per case), so the plain COUNT(*) replaces COUNT(DISTINCT).
CREATE OR REPLACE FUNCTION public.get_statistics_monthly_trend(
  p_months INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH params AS (
      SELECT LEAST(GREATEST(COALESCE(p_months, 12), 1), 36) AS n,
             date_trunc('month', timezone('Asia/Jerusalem', now()))::date AS cur
    ),
    months AS (
      SELECT ((SELECT cur FROM params) - make_interval(months => g))::date AS month_start
        FROM generate_series(0, (SELECT n FROM params) - 1) AS g
    ),
    es AS (
      SELECT id FROM public.case_statuses WHERE key IN ('execution', 'closed')
    ),
    -- Every stage row per case, newest first, flagged as milestone or not.
    hist AS (
      SELECT sd.case_id, sd.entered_at,
             (sd.status_id IN (SELECT id FROM es)) AS is_ms,
             ROW_NUMBER() OVER (PARTITION BY sd.case_id ORDER BY sd.entered_at DESC) AS rn_desc
        FROM public.stage_durations sd
        JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
    ),
    -- The case counts only while it is STILL at ביצוע / בוצע ושולם, and the
    -- date is where its CURRENT unbroken run of those stages began.
    -- `first_break` is the position of the newest non-milestone row: rows
    -- newer than it (rn_desc < first_break) are the trailing run. If the
    -- newest row of all is not a milestone, first_break = 1 and nothing
    -- qualifies — the case has left ביצוע and drops out, which is the point.
    -- NULL first_break means the case has never been anywhere else.
    milestone AS (
      SELECT case_id, MIN(entered_at) AS reached_at
        FROM (
          SELECT h.*,
                 MIN(CASE WHEN NOT h.is_ms THEN h.rn_desc END)
                   OVER (PARTITION BY h.case_id) AS first_break
            FROM hist h
        ) x
       WHERE x.is_ms AND (x.first_break IS NULL OR x.rn_desc < x.first_break)
       GROUP BY case_id
    ),
    opened AS (
      SELECT date_trunc(
               'month',
               timezone(
                 'Asia/Jerusalem',
                 COALESCE(timezone('Asia/Jerusalem', c.opened_at::timestamp), c.created_at)
               )
             )::date AS month_start,
             COUNT(*) AS n
        FROM public.cases c
       WHERE c.deleted_at IS NULL
       GROUP BY 1
    ),
    executed AS (
      SELECT date_trunc('month', timezone('Asia/Jerusalem', m.reached_at))::date AS month_start,
             COUNT(*) AS n
        FROM milestone m
       GROUP BY 1
    )
    SELECT COALESCE(
             jsonb_agg(
               jsonb_build_object(
                 'month', to_char(m.month_start, 'YYYY-MM'),
                 'opened', COALESCE(o.n, 0),
                 'executed', COALESCE(e.n, 0)
               ) ORDER BY m.month_start
             ),
             '[]'::jsonb
           )
      FROM months m
      LEFT JOIN opened o ON o.month_start = m.month_start
      LEFT JOIN executed e ON e.month_start = m.month_start
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_statistics_monthly_trend(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statistics_monthly_trend(INT) TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (244) ON CONFLICT DO NOTHING;
