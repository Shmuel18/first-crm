-- =============================================================================
-- Migration 227: 'stuck' joins the auto-archive set + 'closed' renamed
-- =============================================================================
-- Kaufman's poll (2.8): (a) the closed status should be NAMED "בוצע ושולם"
-- (it was still the seed name "נסגר"); (b) closed, STUCK and frozen should all
-- move to the archive automatically — migration 226 covered closed/on_hold,
-- this extends the same invariant to 'stuck'; (c) with all three auto-
-- archiving, the dashboard's "hide completed & frozen" toggle is removed
-- (companion TS change — the active list is now purely is_archived = FALSE).
--
-- Everything below restates a migration-226 (or 223) function with ONLY the
-- archived-status key set changed from ('closed','on_hold') to
-- ('closed','on_hold','stuck'):
--   1. Rename closed → בוצע ושולם / Completed & Paid (display data only; all
--      logic keys off case_statuses.key).
--   2. sync_case_archive_with_status(): stuck now archives; leaving stuck for
--      an active stage un-archives.
--   3. get_restore_target_status(): a stuck case restores to its last
--      non-closed/frozen/stuck stage.
--   4. Backfill: archive existing stuck cases.
--   5. count_active_cases(): stuck is no longer active — Kaufman's rule,
--      superseding migration 223's "stuck stays active" (his call now that
--      stuck lives in the archive). The bootstrap RPC delegates to this, so
--      the tab badge and realtime fingerprint follow automatically.
--   6. get_statistics_summary(): the snapshot counts stuck regardless of
--      is_archived (like closed/on_hold), and the stuck_cases KPI drops its
--      is_archived filter — every stuck case is archived now, so the old
--      predicate would pin the KPI to 0.
--   7. admin_delete_member(): a deleted member's STUCK cases still move to the
--      acting admin. The reassignment predicate was is_archived = FALSE;
--      with stuck now archived, those live-but-parked cases would silently
--      keep a soft-deleted owner (and resurrect owner-less when un-stuck).
--   8. cases_dashboard_bootstrap(): status_options gains the status KEY so the
--      dashboard can hide auto-archiving stages from the ACTIVE view's stage
--      filter (selecting them there is a guaranteed empty list now).
--
-- The SLA "stuck too long" alert keeps firing: the TS cron's archived-case
-- skip already exempts on_hold and (same commit) now exempts stuck too.
-- collections_overview needs no change — its outstanding-balance clause
-- (migration 226) already retains ANY archived case that still owes money.
--
-- Idempotent. Deps: 145/223 (bootstrap body), 170 (admin_delete_member), 226.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Display rename (logic is key-based; this is what users see)
-- -----------------------------------------------------------------------------
UPDATE public.case_statuses
   SET name_he = 'בוצע ושולם',
       name_en = 'Completed & Paid'
 WHERE key = 'closed';

-- -----------------------------------------------------------------------------
-- 2. Archive-sync trigger: stuck joins closed/on_hold
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

  IF v_key IN ('closed', 'on_hold', 'stuck') THEN
    NEW.is_archived := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status moved to an active stage → the case jumps back out of the
    -- archive. INSERT keeps the provided is_archived so restore-from-backup
    -- preserves manually archived active-status cases.
    NEW.is_archived := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_case_archive_with_status() IS
  'Keeps cases.is_archived in lockstep with the status: closed/on_hold/stuck '
  '→ archived, any active stage (on UPDATE) → un-archived. See migrations '
  '226 + 227.';

-- -----------------------------------------------------------------------------
-- 3. Restore target: stuck is not a stage to restore INTO or stay in
-- -----------------------------------------------------------------------------
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
  IF v_current_key IS NULL OR v_current_key NOT IN ('closed', 'on_hold', 'stuck') THEN
    RETURN NULL;
  END IF;

  -- The most recent ACTIVE stage in the case's history.
  SELECT sd.status_id INTO v_target
    FROM public.stage_durations sd
    JOIN public.case_statuses s ON s.id = sd.status_id
   WHERE sd.case_id = p_case_id
     AND s.key NOT IN ('closed', 'on_hold', 'stuck')
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
  'Stage an archive-restore should return the case to: last stage outside '
  'closed/on_hold/stuck from stage_durations (fallback case_opened); NULL '
  'when the current status is already active. can_edit_case-gated. See '
  'migrations 226 + 227.';

-- -----------------------------------------------------------------------------
-- 4. Backfill: existing stuck cases move into the archive
-- -----------------------------------------------------------------------------
UPDATE public.cases c
   SET is_archived = TRUE
  FROM public.case_statuses s
 WHERE s.id = c.status_id
   AND s.key = 'stuck'
   AND c.is_archived = FALSE;

-- -----------------------------------------------------------------------------
-- 5. Canonical active count: stuck is no longer active
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_cases()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.cases c
  LEFT JOIN public.case_statuses s ON s.id = c.status_id
  WHERE c.deleted_at IS NULL
    AND c.is_archived = FALSE
    AND COALESCE(s.key, '') NOT IN ('closed', 'on_hold', 'stuck');
$$;

COMMENT ON FUNCTION public.count_active_cases() IS
  'Canonical dashboard "active cases" count: non-deleted, non-archived, and '
  'not in a closed/on_hold/stuck status. RLS-scoped (SECURITY INVOKER). Used '
  'by cases_dashboard_bootstrap and the dashboard realtime fingerprint. See '
  'migrations 223 + 227.';

-- -----------------------------------------------------------------------------
-- 6. Statistics: stuck counts survive archiving
-- -----------------------------------------------------------------------------
-- Restates the migration-226 body; changes: snapshot count-all key set gains
-- 'stuck', and the stuck_cases KPI counts ALL non-deleted stuck cases.
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
-- 7. Member delete: stuck cases are live work — they move to the acting admin
-- -----------------------------------------------------------------------------
-- Restates the migration-170 body; ONLY step 1's predicate changed. Stuck is
-- archived-but-monitored (SLA still alerts on it), so it reassigns like open
-- work; closed/on_hold keep history attribution as before.
CREATE OR REPLACE FUNCTION public.admin_delete_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'self delete' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_protected) THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;

  -- 1) Open + stuck cases → acting admin (closed/on_hold keep history
  --    attribution; stuck is archived since migration 227 but still live).
  UPDATE public.cases SET assigned_advisor_id = v_actor, updated_by = v_actor
   WHERE assigned_advisor_id = p_user_id AND deleted_at IS NULL
     AND (
       is_archived = FALSE
       OR status_id IN (SELECT id FROM public.case_statuses WHERE key = 'stuck')
     );

  -- 2) Pending tasks → acting admin.
  UPDATE public.tasks SET assigned_to = v_actor
   WHERE assigned_to = p_user_id AND status = 'pending' AND deleted_at IS NULL;

  -- 3) Associated-advisor rows (the profile is soft-deleted, so the FK
  --    cascade never fires — clean explicitly).
  DELETE FROM public.case_associated_advisors WHERE advisor_id = p_user_id;

  -- 4) Soft-delete + deactivate the profile.
  UPDATE public.profiles
     SET deleted_at = NOW(), is_active = FALSE
   WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_member(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Bootstrap: status_options carries the status KEY
-- -----------------------------------------------------------------------------
-- Restates the migration-223 body; ONLY the status_options jsonb gained
-- 'key' — the dashboard needs it to hide auto-archiving stages from the
-- active view's stage filter. Everything else is unchanged.
CREATE OR REPLACE FUNCTION public.cases_dashboard_bootstrap()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_profile JSONB := NULL;
  v_status_options JSONB := '[]'::jsonb;
  v_bank_options JSONB := '[]'::jsonb;
  v_advisor_options JSONB := '[]'::jsonb;
  v_active_count INT := 0;
  v_archived_count INT := 0;
  v_leads_count INT := 0;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT jsonb_build_object(
    'first_name', p.first_name,
    'last_name', p.last_name
  )
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = v_actor;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'key', s.key,
        'name_he', s.name_he,
        'color', s.color,
        'sort_order', s.sort_order
      )
      ORDER BY s.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_status_options
    FROM public.case_statuses s
   WHERE s.is_active = TRUE;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'key', b.key,
        'name_he', b.name_he,
        'color', b.color,
        'logo_url', b.logo_url
      )
      ORDER BY b.sort_order
    ),
    '[]'::jsonb
  )
    INTO v_bank_options
    FROM public.banks b
   WHERE b.is_active = TRUE;

  -- Identity-only, RLS-independent (SECURITY DEFINER): a view_all_cases holder
  -- who is not an admin still needs the full advisor list to read + filter by
  -- the responsible advisor.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'first_name', a.first_name,
        'last_name', a.last_name
      )
      ORDER BY a.first_name, a.last_name
    ),
    '[]'::jsonb
  )
    INTO v_advisor_options
    FROM public.list_active_advisors() a;

  -- Migration 223: "active" excludes closed/on_hold (and stuck since 227) —
  -- the one canonical definition lives in count_active_cases().
  v_active_count := public.count_active_cases();

  SELECT COUNT(*) INTO v_archived_count
    FROM public.cases c
   WHERE c.deleted_at IS NULL
     AND c.is_archived = TRUE;

  SELECT COUNT(*) INTO v_leads_count
    FROM public.leads l
   WHERE l.deleted_at IS NULL
     AND l.status <> 'converted';

  RETURN jsonb_build_object(
    'authenticated', TRUE,
    'profile', v_profile,
    'status_options', v_status_options,
    'bank_options', v_bank_options,
    'advisor_options', v_advisor_options,
    'counts', jsonb_build_object(
      'active', v_active_count,
      'archived', v_archived_count
    ),
    'leads_count', v_leads_count,
    'can_view_all', public.has_permission('view_all_cases')
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.cases_dashboard_bootstrap() TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (227) ON CONFLICT DO NOTHING;
