-- =============================================================================
-- Migration 243: real case-opening date + cycle-time reporting
-- =============================================================================
-- Kaufman (WhatsApp, 1.9.2026): "תוכל לסדר שאני יוכל לראות בכל תיק במנהלה כמה
-- זמן מפתיחת תיק עד ביצוע" + "שיהיה עוד מקום בסטטיסטיקות סקר כמה זמן אורך תיק".
-- Follow-up, after seeing the trend chart: "הם רוצים שיהיה גם בוצע ושולם פלוס
-- ביצוע, שיראה הכל ולא יצטרכו לחשב".
--
-- Three distinct things, all landing on the same two RPCs:
--
--   1. cases.opened_at — the REAL date the office opened the file.
--      Until now the only opening date was cases.created_at (the row's
--      insert time). The Excel importer (168:164-169) inserts without
--      created_at, so every imported case reads as opened on the IMPORT day
--      — which is why the monthly trend spikes in the import month and why a
--      "days to execution" built on created_at would be far too short for
--      the legacy book. opened_at is nullable and hand-editable in the
--      מנהלה block; NULL keeps the old behaviour, so nothing regresses and
--      Kaufman can correct history case by case.
--
--      Everywhere "when was this case opened" is asked, the anchor is now
--        COALESCE(timezone('Asia/Jerusalem', c.opened_at::timestamp), c.created_at)
--      — opened_at is a calendar DATE (like cases.target_date), so it is
--      resolved as an Israel-local midnight to sit on the same axis as the
--      timestamptz window bounds the RPCs already compute.
--
--   2. "בוצע" now means execution OR completed-and-paid.
--      Both RPCs resolved the milestone as `key = 'execution'` ONLY. A case
--      that jumps straight to 'closed' (renamed 'בוצע ושולם' in migration
--      227) never entered 'execution', so it was invisible in
--      executed_in_period, avg_cycle_days, by_advisor.executed_in_period and
--      the whole monthly trend. The status set becomes ('execution','closed').
--
--      This forces a second change that is NOT cosmetic. The old `executed`
--      CTE applied the period window BEFORE MIN(), i.e. "first entry into
--      execution within this window". With two statuses in the set, a normal
--      case (ביצוע in June → בוצע ושולם in August) would satisfy that
--      predicate in BOTH months and be counted as two deals. So the milestone
--      is now resolved ONCE per case, all-time — MIN(entered_at) over both
--      statuses — and the period filter is applied to that single instant.
--      Each case is therefore counted exactly once, ever, on the day it first
--      reached ביצוע. A case that bounces execution → בטחונות → execution no
--      longer double-counts either (it did before, in two different windows).
--
--   3. Two new payload keys for the statistics page:
--      * cycle_time      — un-windowed distribution of "days from opening to
--                          ביצוע" across every case that ever got there, as
--                          fixed day-range buckets + n + average. Un-windowed
--                          on purpose: at ~80 cases the period-scoped
--                          avg_cycle_days KPI has a single-digit N and swings
--                          wildly, which is exactly what a "סקר" must not do.
--      * stage_breakdown — average days spent in each status, over completed
--                          (exited_at IS NOT NULL) stage_durations rows.
--                          Answers "where do cases actually sit".
--
-- Both new keys are additive; Zod is non-strict and the two new fields carry
-- .default() on the client, so migration-first deploy is safe (and required —
-- next.config bakes EXPECTED_SCHEMA_VERSION from the highest migration number
-- and /api/health 503s `schema_behind` until this is applied).
--
-- Idempotent. Deps: 009 (stage_durations + its triggers), 135 (monthly trend
-- body), 227 (summary body — restated verbatim below except as described).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. cases.opened_at — hand-correctable real opening date
-- -----------------------------------------------------------------------------
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS opened_at DATE;

COMMENT ON COLUMN public.cases.opened_at IS
  'Real date the office opened the file. NULL falls back to created_at. Exists '
  'because bulk-imported cases have created_at = import date; hand-editable in '
  'the מנהלה block so historical cases can be corrected (migration 243).';

-- -----------------------------------------------------------------------------
-- 2. get_statistics_summary — milestone = execution OR closed, opened_at
--    anchor, plus cycle_time + stage_breakdown
-- -----------------------------------------------------------------------------
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
    milestone AS (
      SELECT sd.case_id, MIN(sd.entered_at) AS reached_at
        FROM public.stage_durations sd
        JOIN es ON sd.status_id = es.id
        JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
       GROUP BY sd.case_id
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
    milestone AS (
      SELECT sd.case_id, MIN(sd.entered_at) AS reached_at
        FROM public.stage_durations sd
        JOIN es ON sd.status_id = es.id
        JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
       GROUP BY sd.case_id
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
INSERT INTO public.schema_version (version) VALUES (243) ON CONFLICT DO NOTHING;
