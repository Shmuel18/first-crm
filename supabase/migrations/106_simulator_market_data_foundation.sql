-- =============================================================================
-- Migration 106: Simulator market-data foundation
-- =============================================================================
-- Adds the persistence layer required for the Israel mortgage simulator
-- platform: market-data sources/points/snapshots, purchase-tax brackets,
-- bank offers, and transparent approval rulesets.
-- =============================================================================

-- Existing scenarios can now record the exact market-data snapshot and engine
-- version that produced their result_snapshot.
CREATE TABLE IF NOT EXISTS public.market_data_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  freshness_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.mortgage_scenarios
  ADD COLUMN IF NOT EXISTS market_snapshot_id UUID REFERENCES public.market_data_snapshots(id),
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'sim-v1',
  ADD COLUMN IF NOT EXISTS data_as_of DATE;

ALTER TABLE public.mortgage_scenarios
  DROP CONSTRAINT IF EXISTS mortgage_scenarios_kind_check;

ALTER TABLE public.mortgage_scenarios
  ADD CONSTRAINT mortgage_scenarios_kind_check CHECK (kind IN (
    'mix',
    'comparison',
    'scenario',
    'capacity',
    'early_repayment',
    'refinance',
    'max_mortgage',
    'dti',
    'ltv',
    'monthly_payment',
    'prime_impact',
    'cpi_impact',
    'fixed_variable_compare',
    'repayment_type_compare',
    'balloon_bullet',
    'purchase_tax',
    'closing_costs',
    'guarantor_impact',
    'bank_offer_comparison',
    'best_bank_fit',
    'approval_probability',
    'rent_vs_buy',
    'client_report'
  ));

CREATE OR REPLACE FUNCTION public.can_edit_case(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.cases c
     WHERE c.id = p_case_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_case(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.market_data_sources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key         TEXT NOT NULL UNIQUE,
  name_he            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  source_url         TEXT NOT NULL,
  access_method      TEXT NOT NULL CHECK (access_method IN ('api', 'scrape', 'manual', 'upload')),
  expected_frequency TEXT NOT NULL CHECK (expected_frequency IN ('daily', 'monthly', 'annual', 'event', 'manual')),
  stale_after_hours  INT NOT NULL CHECK (stale_after_hours > 0),
  is_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at    TIMESTAMPTZ,
  last_failure_at    TIMESTAMPTZ,
  last_failure_code  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES public.profiles(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID REFERENCES public.profiles(id),
  deleted_at         TIMESTAMPTZ,
  deleted_by         UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.market_data_points (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           UUID NOT NULL REFERENCES public.market_data_sources(id) ON DELETE CASCADE,
  series_key          TEXT NOT NULL,
  period_start        DATE NOT NULL,
  period_end          DATE,
  value_numeric       NUMERIC(18, 8),
  value_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_published_at TIMESTAMPTZ,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_etag         TEXT,
  source_hash         TEXT,
  is_manual_override  BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.profiles(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          UUID REFERENCES public.profiles(id),
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID REFERENCES public.profiles(id),
  CHECK (is_manual_override = FALSE OR NULLIF(BTRIM(COALESCE(override_reason, '')), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_market_data_points_active
  ON public.market_data_points(source_id, series_key, period_start, is_manual_override)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_market_data_points_latest
  ON public.market_data_points(source_id, series_key, period_start DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.purchase_tax_brackets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from     DATE NOT NULL,
  valid_to       DATE,
  buyer_profile  TEXT NOT NULL CHECK (buyer_profile IN (
    'single_home',
    'additional_home',
    'replacement_home',
    'new_immigrant',
    'disabled',
    'land',
    'commercial',
    'farm'
  )),
  from_amount    BIGINT NOT NULL CHECK (from_amount >= 0),
  to_amount      BIGINT CHECK (to_amount IS NULL OR to_amount > from_amount),
  rate_pct       NUMERIC(8, 4) NOT NULL CHECK (rate_pct >= 0),
  source_id      UUID REFERENCES public.market_data_sources(id),
  source_url     TEXT,
  is_manual      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     UUID REFERENCES public.profiles(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_tax_brackets_active
  ON public.purchase_tax_brackets(valid_from, buyer_profile, from_amount)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.bank_offers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  bank_id            UUID NOT NULL REFERENCES public.banks(id),
  branch_name        TEXT,
  contact_name       TEXT,
  offer_date         DATE NOT NULL,
  expires_at         DATE,
  approval_type      TEXT NOT NULL CHECK (approval_type IN ('initial_approval', 'pricing_offer', 'final_offer', 'manual_quote')),
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES public.profiles(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID REFERENCES public.profiles(id),
  deleted_at         TIMESTAMPTZ,
  deleted_by         UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_offers_case
  ON public.bank_offers(case_id, offer_date DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.bank_offer_tracks (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id                   UUID NOT NULL REFERENCES public.bank_offers(id) ON DELETE CASCADE,
  track_type                 TEXT NOT NULL CHECK (track_type IN ('fixed_unlinked', 'fixed_linked', 'prime', 'variable_unlinked', 'variable_linked', 'eligibility')),
  repayment_type             TEXT NOT NULL CHECK (repayment_type IN ('spitzer', 'equal_principal', 'balloon')),
  amount                     BIGINT NOT NULL CHECK (amount >= 0),
  term_months                INT NOT NULL CHECK (term_months BETWEEN 1 AND 480),
  annual_rate_pct            NUMERIC(8, 4) NOT NULL,
  cpi_annual_assumption_pct  NUMERIC(8, 4),
  prime_margin_pct           NUMERIC(8, 4),
  rate_change_period_months  INT CHECK (rate_change_period_months IS NULL OR rate_change_period_months > 0),
  sort_order                 INT NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                 UUID REFERENCES public.profiles(id),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                 UUID REFERENCES public.profiles(id),
  deleted_at                 TIMESTAMPTZ,
  deleted_by                 UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_offer_tracks_offer
  ON public.bank_offer_tracks(offer_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.approval_rulesets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  bank_id     UUID REFERENCES public.banks(id),
  version     INT NOT NULL DEFAULT 1 CHECK (version > 0),
  rules_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_rulesets_active_version
  ON public.approval_rulesets(COALESCE(bank_id, '00000000-0000-0000-0000-000000000000'::uuid), version)
  WHERE deleted_at IS NULL;

-- Updated-at + audit triggers.
DROP TRIGGER IF EXISTS trg_market_data_sources_updated_at ON public.market_data_sources;
CREATE TRIGGER trg_market_data_sources_updated_at
  BEFORE UPDATE ON public.market_data_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_market_data_points_updated_at ON public.market_data_points;
CREATE TRIGGER trg_market_data_points_updated_at
  BEFORE UPDATE ON public.market_data_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_tax_brackets_updated_at ON public.purchase_tax_brackets;
CREATE TRIGGER trg_purchase_tax_brackets_updated_at
  BEFORE UPDATE ON public.purchase_tax_brackets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bank_offers_updated_at ON public.bank_offers;
CREATE TRIGGER trg_bank_offers_updated_at
  BEFORE UPDATE ON public.bank_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bank_offer_tracks_updated_at ON public.bank_offer_tracks;
CREATE TRIGGER trg_bank_offer_tracks_updated_at
  BEFORE UPDATE ON public.bank_offer_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_approval_rulesets_updated_at ON public.approval_rulesets;
CREATE TRIGGER trg_approval_rulesets_updated_at
  BEFORE UPDATE ON public.approval_rulesets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_market_data_sources ON public.market_data_sources;
CREATE TRIGGER trg_audit_market_data_sources
  AFTER INSERT OR UPDATE OR DELETE ON public.market_data_sources
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_market_data_points ON public.market_data_points;
CREATE TRIGGER trg_audit_market_data_points
  AFTER INSERT OR UPDATE OR DELETE ON public.market_data_points
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_market_data_snapshots ON public.market_data_snapshots;
CREATE TRIGGER trg_audit_market_data_snapshots
  AFTER INSERT OR UPDATE OR DELETE ON public.market_data_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_purchase_tax_brackets ON public.purchase_tax_brackets;
CREATE TRIGGER trg_audit_purchase_tax_brackets
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_tax_brackets
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_bank_offers ON public.bank_offers;
CREATE TRIGGER trg_audit_bank_offers
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_offers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_bank_offer_tracks ON public.bank_offer_tracks;
CREATE TRIGGER trg_audit_bank_offer_tracks
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_offer_tracks
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_approval_rulesets ON public.approval_rulesets;
CREATE TRIGGER trg_audit_approval_rulesets
  AFTER INSERT OR UPDATE OR DELETE ON public.approval_rulesets
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

-- RLS.
ALTER TABLE public.market_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_tax_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_offer_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rulesets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_data_sources_select" ON public.market_data_sources;
DROP POLICY IF EXISTS "market_data_sources_insert" ON public.market_data_sources;
DROP POLICY IF EXISTS "market_data_sources_update" ON public.market_data_sources;
DROP POLICY IF EXISTS "market_data_points_select" ON public.market_data_points;
DROP POLICY IF EXISTS "market_data_points_insert" ON public.market_data_points;
DROP POLICY IF EXISTS "market_data_points_update" ON public.market_data_points;
DROP POLICY IF EXISTS "market_data_snapshots_select" ON public.market_data_snapshots;
DROP POLICY IF EXISTS "market_data_snapshots_insert" ON public.market_data_snapshots;
DROP POLICY IF EXISTS "purchase_tax_brackets_select" ON public.purchase_tax_brackets;
DROP POLICY IF EXISTS "purchase_tax_brackets_insert" ON public.purchase_tax_brackets;
DROP POLICY IF EXISTS "purchase_tax_brackets_update" ON public.purchase_tax_brackets;
DROP POLICY IF EXISTS "bank_offers_select" ON public.bank_offers;
DROP POLICY IF EXISTS "bank_offers_insert" ON public.bank_offers;
DROP POLICY IF EXISTS "bank_offers_update" ON public.bank_offers;
DROP POLICY IF EXISTS "bank_offer_tracks_select" ON public.bank_offer_tracks;
DROP POLICY IF EXISTS "bank_offer_tracks_insert" ON public.bank_offer_tracks;
DROP POLICY IF EXISTS "bank_offer_tracks_update" ON public.bank_offer_tracks;
DROP POLICY IF EXISTS "approval_rulesets_select" ON public.approval_rulesets;
DROP POLICY IF EXISTS "approval_rulesets_insert" ON public.approval_rulesets;
DROP POLICY IF EXISTS "approval_rulesets_update" ON public.approval_rulesets;

CREATE POLICY "market_data_sources_select" ON public.market_data_sources
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('view_simulators'));

CREATE POLICY "market_data_sources_insert" ON public.market_data_sources
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "market_data_sources_update" ON public.market_data_sources
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('manage_simulator_settings'))
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "market_data_points_select" ON public.market_data_points
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('view_simulators'));

CREATE POLICY "market_data_points_insert" ON public.market_data_points
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "market_data_points_update" ON public.market_data_points
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('manage_simulator_settings'))
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "market_data_snapshots_select" ON public.market_data_snapshots
  FOR SELECT TO authenticated
  USING (public.has_permission('view_simulators'));

CREATE POLICY "market_data_snapshots_insert" ON public.market_data_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_permission('use_simulators'));

CREATE POLICY "purchase_tax_brackets_select" ON public.purchase_tax_brackets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('view_simulators'));

CREATE POLICY "purchase_tax_brackets_insert" ON public.purchase_tax_brackets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "purchase_tax_brackets_update" ON public.purchase_tax_brackets
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('manage_simulator_settings'))
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "bank_offers_select" ON public.bank_offers
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('view_simulators') AND public.can_view_case(case_id));

CREATE POLICY "bank_offers_insert" ON public.bank_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND public.has_permission('use_simulators')
    AND public.can_edit_case(case_id)
  );

CREATE POLICY "bank_offers_update" ON public.bank_offers
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('use_simulators') AND public.can_edit_case(case_id))
  WITH CHECK (public.has_permission('use_simulators') AND public.can_edit_case(case_id));

CREATE POLICY "bank_offer_tracks_select" ON public.bank_offer_tracks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.bank_offers o
       WHERE o.id = bank_offer_tracks.offer_id
         AND o.deleted_at IS NULL
         AND public.has_permission('view_simulators')
         AND public.can_view_case(o.case_id)
    )
  );

CREATE POLICY "bank_offer_tracks_insert" ON public.bank_offer_tracks
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bank_offers o
       WHERE o.id = bank_offer_tracks.offer_id
         AND o.deleted_at IS NULL
         AND public.has_permission('use_simulators')
         AND public.can_edit_case(o.case_id)
    )
  );

CREATE POLICY "bank_offer_tracks_update" ON public.bank_offer_tracks
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.bank_offers o
       WHERE o.id = bank_offer_tracks.offer_id
         AND o.deleted_at IS NULL
         AND public.has_permission('use_simulators')
         AND public.can_edit_case(o.case_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bank_offers o
       WHERE o.id = bank_offer_tracks.offer_id
         AND o.deleted_at IS NULL
         AND public.has_permission('use_simulators')
         AND public.can_edit_case(o.case_id)
    )
  );

CREATE POLICY "approval_rulesets_select" ON public.approval_rulesets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('view_simulators'));

CREATE POLICY "approval_rulesets_insert" ON public.approval_rulesets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('manage_simulator_settings'));

CREATE POLICY "approval_rulesets_update" ON public.approval_rulesets
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('manage_simulator_settings'))
  WITH CHECK (public.has_permission('manage_simulator_settings'));

INSERT INTO public.market_data_sources (
  source_key,
  name_he,
  name_en,
  source_url,
  access_method,
  expected_frequency,
  stale_after_hours
) VALUES
  ('boi_rate', 'ריבית בנק ישראל', 'Bank of Israel policy rate', 'https://www.boi.org.il/en/economic-roles/monetary-policy/', 'scrape', 'event', 720),
  ('cpi', 'מדד המחירים לצרכן', 'Consumer Price Index', 'https://www.cbs.gov.il/en/Pages/Api-Indices.aspx', 'api', 'monthly', 1080),
  ('construction_index', 'מדד תשומות הבנייה', 'Construction input index', 'https://www.cbs.gov.il/en/Pages/Api-Indices.aspx', 'api', 'monthly', 1080),
  ('boi_mortgage_rates', 'ריביות משכנתא ממוצעות', 'Average mortgage rates', 'https://www.boi.org.il/en/information-and-service-to-the-public/interest-rates-and-early-repayment-fees/interest-rate-comparisons-housing-loans/', 'scrape', 'monthly', 1080),
  ('purchase_tax', 'מדרגות מס רכישה', 'Purchase tax brackets', 'https://www.gov.il/he/service/real_eatate_taxsimulator', 'manual', 'annual', 8760),
  ('real_estate_transactions', 'עסקאות נדל"ן', 'Real estate transactions', 'https://www.nadlan.gov.il/', 'manual', 'manual', 8760)
ON CONFLICT (source_key) DO UPDATE SET
  name_he = EXCLUDED.name_he,
  name_en = EXCLUDED.name_en,
  source_url = EXCLUDED.source_url,
  access_method = EXCLUDED.access_method,
  expected_frequency = EXCLUDED.expected_frequency,
  stale_after_hours = EXCLUDED.stale_after_hours,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
