-- =============================================================================
-- Migration 135: Manager statistics RPCs
-- =============================================================================
-- Purpose: Power the manager-only /statistics dashboard. Two SECURITY DEFINER
--   functions, each gated on public.is_admin() up front (non-admins get
--   'not authorized'). DEFINER is required because the aggregates read
--   stage_durations and case_financials, which the regular RLS policies do
--   NOT expose to a normal authenticated read.
--
-- Key data sources (no new tables — reuses existing infrastructure):
--   * cases.created_at            → "cases opened" in a period
--   * stage_durations             → "entered <status> at" history (migration
--                                    009; auto-populated by the status-change
--                                    trigger). "Executed" = entered the
--                                    'execution' status (resolved by KEY, so
--                                    it survives status-palette refreshes).
--   * case_statuses               → current pipeline snapshot + colors
--   * profiles                    → per-advisor breakdown
--   * case_financials             → manager-only fee / expected-income totals
--   * leads.converted_at          → lead → case conversion count
--
-- Conventions:
--   * Counts EXCLUDE soft-deleted cases (deleted_at IS NULL).
--   * "Active" snapshot also excludes archived (is_archived = FALSE) — the live
--     pipeline. Period counts (opened / executed) INCLUDE archived, because a
--     completed deal is frequently archived and must still be counted.
--   * Monthly buckets use the Asia/Jerusalem calendar (the office timezone) so
--     "end of month" lines up with the operator's wall clock, not UTC.
--
-- Dependencies: 002 (is_admin), 004/082 (case_statuses incl. 'execution'),
--               006 (cases), 009 (stage_durations), 025 (case_financials).
-- =============================================================================

-- =============================================================================
-- get_statistics_summary(p_from, p_to)
-- =============================================================================
-- Returns a single JSON envelope for the selected reporting period:
--   { period, kpis, status_snapshot[], by_advisor[], financial }
-- p_period is one of: 'this_month' (default), 'last_month', 'last_3_months',
-- 'this_year'. The half-open range [from, to) is computed here in the office
-- timezone (Asia/Jerusalem) so it stays consistent with the monthly-trend
-- buckets — rather than trusting client-side timezone math.
CREATE OR REPLACE FUNCTION public.get_statistics_summary(
  p_period TEXT DEFAULT 'this_month'
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
      -- 'this_month' (default / unrecognized key)
      v_from := v_month_start;
      v_to   := v_month_start + INTERVAL '1 month';
  END CASE;

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
      -- Live pipeline: every active status with its current case count.
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
            SELECT status_id, COUNT(*) AS n
              FROM public.cases
             WHERE deleted_at IS NULL AND is_archived = FALSE
             GROUP BY status_id
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
        'executed_fee_total', (
          SELECT COALESCE(SUM(cf.fee_amount), 0)
            FROM executed e
            JOIN public.case_financials cf ON cf.case_id = e.case_id
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

-- =============================================================================
-- get_statistics_monthly_trend(p_months)
-- =============================================================================
-- Returns a JSON array, oldest month first, one entry per calendar month for
-- the trailing p_months (default 12, clamped to 1..36):
--   [{ "month": "2026-06", "opened": <int>, "executed": <int> }, ...]
-- Buckets by the Asia/Jerusalem calendar month.
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
      SELECT id FROM public.case_statuses WHERE key = 'execution'
    ),
    opened AS (
      SELECT date_trunc('month', timezone('Asia/Jerusalem', c.created_at))::date AS month_start,
             COUNT(*) AS n
        FROM public.cases c
       WHERE c.deleted_at IS NULL
       GROUP BY 1
    ),
    executed AS (
      SELECT date_trunc('month', timezone('Asia/Jerusalem', sd.entered_at))::date AS month_start,
             COUNT(DISTINCT sd.case_id) AS n
        FROM public.stage_durations sd
        JOIN es ON sd.status_id = es.id
        JOIN public.cases c ON c.id = sd.case_id AND c.deleted_at IS NULL
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

REVOKE ALL ON FUNCTION public.get_statistics_summary(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_statistics_monthly_trend(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statistics_summary(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_statistics_monthly_trend(INT) TO authenticated;
