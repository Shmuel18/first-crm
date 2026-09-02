-- =============================================================================
-- Migration 245: stage averages measure reality, not just the cases that left
-- =============================================================================
-- Kaufman, on "זמן ממוצע בכל שלב": "שהממוצע יהיה כל הזמן לפי המציאות ואם
-- מוציאים מישהו שירד מהממוצע". Two separate defects behind that.
--
-- 1. SURVIVORSHIP. The average counted only visits that had ENDED
--    (exited_at IS NOT NULL), which is exactly the set of cases that moved on.
--    Cases STUCK in a stage are still open, so they were invisible — the very
--    cases the number exists to reveal. Production, before this migration:
--
--      פתיחת תיק      average 3.4 days   ...while 13 cases had been sitting
--                                         there 52.0 days on average
--      איסוף מסמכים   average 21.8 days  ...while 18 cases had been sitting
--                                         there 48.8 days on average
--
--    A visit now contributes COALESCE(exited_at, now()) - entered_at, so a
--    case still in the stage counts for the time it has been there so far and
--    the figure moves on its own as cases age. `open_n` is returned alongside
--    `n` so the UI can say how much of the average is still in progress.
--
-- 2. CORRECTIONS. A status set by mistake and undone leaves a seconds-long
--    visit that drags the stage average toward zero (it is why בוצע ושולם
--    reported 0.0 days over 6 visits). Those are dropped — "אם מוציאים מישהו
--    שירד מהממוצע".
--
--    The test is DIRECTION, not duration. A minimum-dwell threshold was the
--    obvious idea and is wrong here: פתיחת תיק has 59 visits under an hour and
--    ZERO of them are corrections — opening a case and moving it straight to
--    איסוף מסמכים is real work, and a time cutoff would delete half the stage's
--    history. Every correction instead shows up as the case going BACKWARD to
--    an earlier sort_order, so that is what gets filtered. No magic number,
--    and it matches migration 244's "a mis-set status never happened" rule.
--
-- Effect on production (done-only → done+open+forward-only):
--    פתיחת תיק     3.4 →  8.2      איסוף מסמכים  21.8 → 34.3
--    הוגש לבנק    15.6 → 19.4      אושר עקרונית  22.2 → 28.5
--    בטחונות      17.0 → 22.0      ביצוע         19.1 → 18.4
--
-- An ARCHIVED case's open visit is excluded (its completed visits still count).
-- Archiving writes is_archived alone and migration 226's sync trigger only
-- fires on a status change, so a case archived mid-pipeline keeps its stage row
-- open forever — production has seven parked in פתיחת תיק at 57 days and
-- climbing, which would otherwise inflate that stage without ever converging.
--
-- Terminal and parked statuses (closed / stuck / on_hold) are still returned;
-- the PANEL hides them, reusing the same split the pipeline funnel already
-- applies, because "how long since a case was marked paid" is not a stage
-- duration. That choice lives in TS so it is one line to revisit.
--
-- Only get_statistics_summary is restated — get_statistics_monthly_trend does
-- not carry stage_breakdown and keeps its migration 244 body. Idempotent, no
-- schema change. Deps: 243 (payload shape), 244 (the rest of this body).
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
                     'n', sb.n,
                     'open_n', sb.open_n
                   ) ORDER BY s.sort_order
                 ),
                 '[]'::jsonb
               )
          FROM (
            SELECT v.status_id,
                   AVG(v.days) AS avg_days,
                   COUNT(*) AS n,
                   COUNT(*) FILTER (WHERE v.is_open) AS open_n
              FROM (
                SELECT sd.status_id,
                       EXTRACT(
                         EPOCH FROM (COALESCE(sd.exited_at, now()) - sd.entered_at)
                       ) / 86400 AS days,
                       sd.exited_at IS NULL AS is_open,
                       c.is_archived,
                       st.sort_order AS sort_order,
                       LEAD(st.sort_order) OVER (
                         PARTITION BY sd.case_id ORDER BY sd.entered_at
                       ) AS next_sort
                  FROM public.stage_durations sd
                  JOIN public.case_statuses st ON st.id = sd.status_id
                  JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
              ) v
             -- An ARCHIVED case's open visit is not in progress. Archiving
             -- writes is_archived alone (toggle-archive.ts), and migration
             -- 226's sync trigger is BEFORE UPDATE OF status_id — so a case
             -- archived at an active stage keeps that stage row open forever
             -- and now() would grow its duration by a day per day. Production
             -- has seven such cases parked in פתיחת תיק, averaging 57 days.
             -- Their COMPLETED visits still count: those are real measured
             -- history. Dropping only the open term also makes this agree with
             -- status_snapshot, which already excludes archived cases from the
             -- active stages.
             --
             -- Both predicates sit OUTSIDE the subquery on purpose: LEAD() must
             -- see the unfiltered history, or removing a row would hand its
             -- predecessor next_sort = NULL and silently readmit a backward
             -- correction.
             WHERE NOT (v.is_open AND v.is_archived)
               -- Keep a visit the case is still in, one that ended the history,
               -- and one it left by moving FORWARD. Drop only the ones it
               -- backed out of — those are corrections.
               AND (v.is_open OR v.next_sort IS NULL OR v.next_sort >= v.sort_order)
             GROUP BY v.status_id
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

REVOKE ALL ON FUNCTION public.get_statistics_summary(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statistics_summary(TEXT, DATE, DATE) TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (245) ON CONFLICT DO NOTHING;
