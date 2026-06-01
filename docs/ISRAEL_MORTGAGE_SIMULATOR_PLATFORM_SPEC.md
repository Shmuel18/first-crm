# Israel Mortgage Simulator Platform Specification

Last reviewed: 2026-06-01

## Executive System Vision

Build a professional Israeli mortgage simulation platform inside the Kaufman CRM. The platform is not a generic calculator page. It is a case-aware advisory workspace where an Israeli mortgage advisor can:

- Pull reliable Israeli market assumptions where official data exists.
- Override every assumption manually when the advisor has a bank quote, internal office policy, or client-specific condition.
- Simulate affordability, LTV, mix, stress, refinance, early repayment, tax, closing costs, rent-vs-buy, bank offers, and approval probability.
- Save every simulation as an immutable snapshot attached to a case, borrower, or standalone draft.
- Produce Hebrew RTL client-facing PDF reports with advisor conclusions and source/freshness disclosures.
- Preserve security, RLS, auditability, and soft-delete discipline expected from a financial CRM.

The current codebase already has the first simulator layer:

- `src/features/simulators/domain/*`: pure amortization/mix/stress domain functions.
- `mortgage_scenarios` and `scenario_tracks`: persisted scenarios and tracks with RLS.
- Routes for mix, comparison, stress, saved scenarios, reports, and regulatory settings.

This specification keeps that foundation and extends it into a full platform. The first rule remains: the advisor owns the advice. Automatic data helps prefill assumptions and show freshness, but the saved simulation must always record the exact values used.

## Product Principles

1. Israel only. All defaults, regulation, terminology, taxes, and reports are built for Israeli mortgages.
2. Pure engine. Calculations live in `src/features/simulators/domain/` and import no UI, DB, Supabase, Next, or browser APIs.
3. Snapshot everything. Every saved result stores `inputs`, `result_snapshot`, `market_snapshot_id`, `engine_version`, and `data_as_of`.
4. Manual override is first-class. Every automatic value has an override value, override reason, actor, timestamp, and audit entry.
5. Never pretend a data source is authoritative when it is not. Bank publications and real-estate comps often require manual validation.
6. No live-bank dependency for core advisory flow. The CRM must work when bank feeds fail.
7. Hebrew RTL is primary. English may exist, but PDF/client artifacts default to Hebrew.

## Israeli Data-Source Map

Use automatic ingestion only for official/public data that has stable access. Everything else enters as manual office assumptions or uploaded bank offers.

| Data | Exact Source | URL | Access Method | Frequency | Reliability | Legal/Compliance Concern | Fallback | Manual Override |
|---|---|---|---|---|---|---|---|---|
| Bank of Israel policy rate | Bank of Israel monetary policy / statistics | https://www.boi.org.il/en/economic-roles/monetary-policy/ and https://www.boi.org.il/en/economic-roles/statistics/ | Prefer BOI statistics/SDMX if a stable series is found; otherwise scrape official page with checksum and alert on layout drift | 8 decisions/year, plus page updates | High | Public data, cite source and date; never present as investment advice | Keep last known value with stale badge | Admin can set office policy rate with reason |
| Prime rate | Derived from Bank of Israel rate + Israeli banking convention | BOI mortgage reform page: https://www.boi.org.il/information/bank-paymnts/financial-education/%D7%94%D7%A8%D7%A4%D7%95%D7%A8%D7%9E%D7%94-%D7%9C%D7%94%D7%92%D7%91%D7%A8%D7%AA-%D7%A9%D7%A7%D7%99%D7%A4%D7%95%D7%AA-%D7%94%D7%9E%D7%99%D7%93%D7%A2-%D7%95%D7%94%D7%AA%D7%97%D7%A8%D7%95%D7%AA-%D7%91%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90%D7%95%D7%AA/ | Calculate `prime = boi_rate + prime_margin`. Default `prime_margin = 1.5%`, stored in market settings | When BOI rate changes or margin changes | High for formula, but bank-specific offers use margins | Disclose formula and source | Last BOI rate + last margin | Admin can edit margin globally; advisor can override per scenario |
| CPI index | Israel Central Bureau of Statistics price index API | https://www.cbs.gov.il/en/Pages/Api-Indices.aspx | API endpoint `https://api.cbs.gov.il/index/data/price?id=120010&format=json/xml...` after validating series ID in catalog | Monthly, typically around 15th | High | CBS requires proper User-Agent; store source URL and query | Last published CPI; mark stale after 45 days | Advisor can set scenario CPI assumption |
| Historical CPI | CBS index API | https://www.cbs.gov.il/en/Pages/Api-Indices.aspx | API `price?id=120010&startPeriod=MM-YYYY&endPeriod=MM-YYYY` | Static with occasional revisions | High | Same as above | Freeze imported historical rows | Admin can correct a month with audit |
| Construction input index | CBS price index API, chapter `c` residential building input | https://www.cbs.gov.il/en/Pages/Api-Indices.aspx | API catalog for chapter `c`; persist selected series code after verification | Monthly | High | Relevant only for contractor/new-build simulations; disclose | Last known with stale badge | Advisor override per closing-cost/new-build scenario |
| Average mortgage rates | Bank of Israel interest comparisons / early repayment fee source | https://www.boi.org.il/en/information-and-service-to-the-public/interest-rates-and-early-repayment-fees/interest-rate-comparisons-housing-loans/ | Prefer official downloadable graph/data if exposed; otherwise scheduled scraper with DOM contract tests | Monthly | Medium-high; BOI says banks bear data liability | Must display as comparison data, not guaranteed quote | Last official monthly data; manual import CSV | Admin can import rates by linkage/term bucket |
| Early repayment reference rates | Bank of Israel early repayment fee / average effective rates | BOI interest-rate and early repayment fee pages; reform page above | Same market-rates adapter; bucket by linkage, fixed/variable, remaining term | Monthly | Medium-high | Estimate only; final fee must be bank payoff letter | Manual bank payoff value | Advisor must be able to override exact fee |
| Mortgage regulation thresholds | Bank of Israel Banking Supervision | Variable-rate/LTV/PTI directive: https://www.boi.org.il/en/communication-and-publications/press-releases/directive-regarding-the-removal-of-restrictions-on-providing-variable-rate-housing-loans-effective-date/ and proper conduct directives | Manual curated settings, not blind scraping | On regulation change | High if curated | Needs legal/admin validation before changing production thresholds | Existing `regulatory_thresholds` | Admin-only settings with audit |
| Purchase tax brackets | Israel Tax Authority service page | https://www.gov.il/he/service/real_eatate_taxsimulator | Scrape official service page and/or manual annual table entry. Do not depend on private calculator sites | Brackets currently stated for 16.01.2025-15.01.2028 on source page; check annually | High | Source page warns law prevails on mismatch; report must show disclaimer | Freeze current brackets; alert if source changes | Admin can maintain bracket table by validity range |
| Real-estate transactions | Government real estate site / GovMap / Tax Authority source | https://www.nadlan.gov.il/ and https://www.govmap.gov.il/ | No stable public API should be assumed. Treat as manual lookup/import or controlled adapter only after legal review | Irregular, delayed | Medium | Scraping terms and data accuracy risk; must disclose comps are indicative | Manual comparable-property entries | Advisor imports comps manually |
| Bank publications and tariffs | Individual Israeli banks and BOI comparison pages | Bank websites, uploaded approvals, BOI comparison page | Manual upload + structured parser later; no generic live scrape for MVP | Per bank / quote expiry | Low-medium | Copyright/terms, stale offers, client-specific pricing | Manual bank-offer entry | Advisor enters/edits every bank offer |
| Eligibility loan assumptions | Ministry of Construction and Housing + BOI reform explanation | BOI reform page; Ministry of Construction and Housing services | Manual eligibility amount; rate formula uses lower of average CPI-linked rate minus 0.5% or 3.0% unless changed by official rules | When average rates/rules change | Medium | Eligibility requires official certificate; system cannot certify eligibility | Manual rate/amount | Advisor override required |

## Israeli Bank Coverage

The platform should treat banks as CRM entities, not as hardcoded enums. The existing `banks` table remains the canonical registry. Add metadata columns or a companion `bank_profiles` table only if the existing table cannot hold operational fields.

Minimum active mortgage-bank registry for MVP:

| Bank | Public Mortgage URL | Use in Platform | Automation Position |
|---|---|---|---|
| Mizrahi-Tefahot | https://www.mizrahi-tefahot.co.il/mortgages/ | Mortgage offer entry, benchmark comparison, bank-fit rules | Manual offer entry. Public pages are informational, not reliable quote feeds |
| Bank Hapoalim | https://www.bankhapoalim.co.il/he/mortgage | Mortgage offer entry, approval workflow, bank-fit rules | Manual offer entry. Public pages can support content links only |
| Bank Leumi | https://www.leumi.co.il/ | Mortgage offer entry and bank-fit rules | Manual offer entry; verify current mortgage page during implementation |
| Discount Bank | https://www.discountbank.co.il/private/mortgage/ and https://mortgage.discountbank.co.il/ | Mortgage offer entry, bank-fit rules | Manual offer entry |
| Mercantile | https://mortgage.mercantile.co.il/ | Mortgage offer entry for relevant clients | Manual offer entry |
| First International / FIBI group | https://www.fibi.co.il/ | Mortgage offer entry and group-level bank-fit notes | Manual offer entry; verify product URL during implementation |
| Bank Jerusalem | https://www.bankjerusalem.co.il/mortgage | Mortgage offer entry, bridge/grace specialty notes | Manual offer entry |

Implementation rules:

- Store official bank offer documents in `documents` and link them to `bank_offers.source_document_id`.
- Never scrape client-specific offers from bank websites unless a formal API/consent process exists.
- `best-bank-fit` may use internal office history and admin-maintained appetite tags, but must show reason codes and confidence.
- Bank public URLs are evidence links and service-entry points, not binding data sources.

### Data Freshness Rules

- `fresh`: data imported within expected interval plus grace period.
- `stale`: expected update missed by more than grace period.
- `manual`: value is user/admin supplied, not automatically refreshed.
- `failed`: last ingestion failed; UI must show last successful value and failure time.
- Reports must show: source name, value date, imported date, and manual override badge.

## Current Implementation Fit

Keep the current module and add around it:

- Existing `mortgage_scenarios`: scenario header, case linkage, borrower linkage, JSONB inputs and result snapshot.
- Existing `scenario_tracks`: normalized track rows for queryable mortgage mix data.
- Existing `regulatory_thresholds`: admin-editable thresholds.

Required changes:

- Expand `ScenarioKind` in TypeScript/Zod from `mix | comparison | scenario` to the DB-supported set plus new platform types.
- Add market-data tables and services.
- Add `simulation_runs` or extend `mortgage_scenarios` with typed `kind` and a versioned result schema. Recommended: keep `mortgage_scenarios` as the user-facing saved artifact and add `market_data_snapshots`.
- Add domain calculators per simulator, all pure and tested.

## Platform Data Model

### New/Extended Tables

`market_data_sources`

- `id uuid pk`
- `key text unique` (`boi_rate`, `cpi`, `construction_index`, `purchase_tax`, `boi_mortgage_rates`, `real_estate_transactions`)
- `name_he text`, `name_en text`
- `source_url text`
- `access_method text check in ('api','scrape','manual','upload')`
- `expected_frequency text check in ('daily','monthly','annual','event','manual')`
- `stale_after_hours int`
- `is_enabled boolean`
- `last_success_at timestamptz`, `last_failure_at timestamptz`, `last_failure_code text`
- audit columns, soft-delete if source removed

`market_data_points`

- `id uuid pk`
- `source_id uuid fk market_data_sources`
- `series_key text`
- `period_start date`, `period_end date`
- `value_numeric numeric(18,8)`
- `value_json jsonb not null default '{}'`
- `source_published_at timestamptz`
- `fetched_at timestamptz not null`
- `source_etag text`, `source_hash text`
- `is_manual_override boolean not null default false`
- `override_reason text`
- `created_by uuid`, `updated_by uuid`
- unique `(source_id, series_key, period_start, is_manual_override)` with partial active policy

`market_data_snapshots`

- `id uuid pk`
- `created_at timestamptz`
- `created_by uuid`
- `snapshot_json jsonb`: exact market assumptions used by a saved simulation
- `source_versions jsonb`: point IDs and hashes
- `freshness_json jsonb`

`purchase_tax_brackets`

- `id uuid pk`
- `valid_from date`, `valid_to date`
- `buyer_profile text check in ('single_home','additional_home','replacement_home','new_immigrant','disabled','land','commercial','farm')`
- `from_amount bigint`, `to_amount bigint null`
- `rate_pct numeric(8,4)`
- `source_id uuid`, `source_url text`
- `is_manual boolean`, audit columns
- unique `(valid_from, buyer_profile, from_amount)`

`real_estate_comps`

- `id uuid pk`
- `case_id uuid null fk cases`
- `city text`, `street text`, `house_number text`, `block text`, `parcel text`
- `rooms numeric(4,1)`, `area_sqm numeric(8,2)`, `floor text`, `property_type text`
- `transaction_date date`, `price bigint`
- `source text check in ('nadlan_gov','govmap','manual','appraisal')`
- `source_url text`, `confidence text check in ('low','medium','high')`
- audit columns

`bank_offers`

- `id uuid pk`
- `case_id uuid fk cases`
- `bank_id uuid fk banks`
- `branch_name text`, `contact_name text`
- `offer_date date`, `expires_at date`
- `approval_type text check in ('initial_approval','pricing_offer','final_offer','manual_quote')`
- `source_document_id uuid null fk documents`
- `notes text`
- audit columns, soft-delete

`bank_offer_tracks`

- `id uuid pk`
- `offer_id uuid fk bank_offers`
- `track_type text`
- `repayment_type text`
- `amount bigint`
- `term_months int`
- `annual_rate_pct numeric(8,4)`
- `cpi_annual_assumption_pct numeric(8,4) null`
- `prime_margin_pct numeric(8,4) null`
- `rate_change_period_months int null`
- `sort_order int`

`approval_rulesets`

- `id uuid pk`
- `name text`
- `bank_id uuid null`
- `version int`
- `rules_json jsonb`
- `is_active boolean`
- `created_by uuid`, `created_at timestamptz`

### RLS and Audit

- All simulator and market data tables require RLS.
- `market_data_points`: everyone with `view_simulators` can read active points; only `manage_simulator_settings` can insert/update manual overrides.
- `real_estate_comps`: read/write only if user can view/edit the case; standalone comps are created_by private.
- `bank_offers`: read/write only through case permission and `use_simulators`.
- No physical delete policies. Use `deleted_at` where records are user-owned or case-owned.
- Every market-data override and settings change writes to `audit_log`.

## Calculation Engine Specification

All money is stored and calculated as agorot integers internally. Percent values are decimal percentages, not fractions, at API boundaries. Domain functions convert to monthly rates explicitly.

Folder plan:

```text
src/features/simulators/
  domain/
    money.ts
    rate.ts
    amortization-spitzer.ts
    amortization-equal-principal.ts
    amortization-balloon.ts
    cpi-indexation.ts
    max-mortgage.ts
    dti.ts
    ltv.ts
    monthly-payment.ts
    prime-impact.ts
    cpi-impact.ts
    fixed-variable-compare.ts
    repayment-type-compare.ts
    refinance-savings.ts
    early-repayment-penalty.ts
    purchase-tax.ts
    closing-costs.ts
    guarantor-impact.ts
    bank-offer-compare.ts
    best-bank-fit.ts
    approval-probability.ts
    rent-vs-buy.ts
    regulatory-rules.ts
    result-snapshot.ts
  schemas/
  services/
  actions/
  components/
  hooks/
  pdf/
```

Required engine invariants:

- Last amortization row must close remaining balance to zero for non-balloon terminal schedules.
- CPI-linked tracks apply monthly CPI to balance before interest calculation.
- Prime tracks calculate `boi_rate + prime_margin + customer_margin`, with all parts stored in snapshot.
- Variable tracks require `anchor_type`, `change_period_months`, and future scenario assumptions.
- Result snapshots include `engine_version`.
- Golden tests compare known Excel/manual fixtures for at least 360-month Spitzer, equal-principal, CPI-linked, balloon, refinance, and purchase tax.

## Full Simulator Inventory

Each simulator is a typed `ScenarioKind` or tool mode. All save actions must rerun the engine server-side and persist authoritative result snapshots.

### 1. Maximum Mortgage Simulator

- Purpose: Estimate maximum loan amount under Israeli affordability, LTV, property type, and term constraints.
- Workflow: Advisor opens from case or `/simulators/max-mortgage`, imports income/obligations/property if case-linked, adjusts desired term/rates, sees max loan and blockers.
- Inputs: net household income, fixed obligations, desired max payment, property value, property kind, term months, rate assumptions, borrower age/end age, existing equity.
- Outputs: max mortgage by DTI, max mortgage by LTV, binding constraint, monthly payment, required equity gap, warnings.
- Logic: available income = net income - fixed obligations; payment cap = min(advisor max, income * PTI threshold); solve principal by inverse annuity for selected rate/term; LTV cap from thresholds.
- Israeli sources: BOI regulation thresholds, BOI/office rate assumptions, case income data.
- Manual vs automatic: automatic from case financials; rates and threshold overrides allowed.
- DB: `mortgage_scenarios`, `market_data_snapshots`; no tracks unless saving recommended mix.
- Backend/API: `calculateMaximumMortgage(input, assumptions)`, `saveMaximumMortgageAction`.
- UI: income cards, constraint waterfall, equity gap indicator, regulatory violations banner.
- CRM integration: prefill from borrower incomes/obligations and case property value; save to case simulations.
- PDF: "יכולת מימון מקסימלית" section with assumptions table.
- Permissions: `view_simulators`, `use_simulators`; income visibility must respect case permissions.
- Edge cases: zero income, negative disposable income, property value missing, investment property LTV.
- Tests: inverse annuity fixtures, DTI/LTV caps, missing data.
- Acceptance: advisor can calculate and save max loan with explicit binding reason.

### 2. DTI Simulator

- Purpose: Show debt-to-income/payment-to-income risk for a mortgage scenario.
- Workflow: Select borrower/case, load income and obligations, test monthly payment options.
- Inputs: monthly net income, obligations, proposed mortgage payment, stress payment, household members.
- Outputs: DTI/PTI percent, safe/warning/high-risk bands, available income.
- Logic: reuse/extend `src/features/cases/domain/dti.ts`; `pti = mortgage_payment / net_income`, `dti = (obligations + mortgage_payment) / net_income`.
- Israeli sources: office regulatory thresholds; no external feed required.
- Manual vs automatic: case values automatic; advisor can override for what-if.
- DB: saved in `inputs`/`result_snapshot`.
- Backend/API: pure `calculateDtiScenario`.
- UI: gauge, input table, stress toggle.
- CRM integration: reads incomes/obligations.
- PDF: affordability risk page.
- Permissions: same as financial data; hide sensitive income from users lacking access if such role exists.
- Edge cases: income zero, non-monthly income, future employment start.
- Tests: zero denominator, combined borrowers, obligations excluded/included.
- Acceptance: DTI updates live and saved PDF matches snapshot.

### 3. LTV Simulator

- Purpose: Calculate Israeli loan-to-value constraints by buyer/property kind.
- Workflow: Advisor enters property value, requested mortgage, buyer profile.
- Inputs: property value, purchase price, appraisal value, mortgage amount, property kind, government program flag.
- Outputs: LTV %, allowed max, excess amount, required equity, program caveats.
- Logic: `ltv = mortgage / min_or_policy_value`; default thresholds first home 75%, replacement 70%, investment 50%; government discounted programs may use appraisal rules manually.
- Israeli sources: BOI LTV regulation; office thresholds.
- Manual vs automatic: property values from case; policy overrides admin-only.
- DB: `mortgage_scenarios.result_snapshot`.
- Backend/API: `calculateLtvScenario`.
- UI: LTV bar with hard blocker.
- CRM integration: case request details/property block.
- PDF: financing ratio table.
- Permissions: view/use simulators.
- Edge cases: property value zero, multiple properties, foreign resident.
- Tests: threshold bands, property-kind changes.
- Acceptance: blocks save when LTV exceeds configured hard limit unless admin override is enabled.

### 4. Monthly Payment Simulator

- Purpose: Quick payment estimate for a single track or simple loan.
- Workflow: Enter amount/rate/term/repayment type and see monthly payment.
- Inputs: principal, annual rate, term, repayment type, CPI assumption, grace.
- Outputs: first/average/max payment, total interest, schedule.
- Logic: existing Spitzer/equal-principal/balloon engines.
- Israeli sources: BOI/CBS assumptions optional.
- Manual vs automatic: manual first; market assumption prefill optional.
- DB: optional save as `kind='monthly_payment'`.
- Backend/API: domain-only for live; save action for snapshot.
- UI: compact calculator modal and standalone page.
- CRM integration: can seed a new track in mix builder.
- PDF: optional appendix table.
- Permissions: view/use.
- Edge cases: zero rate, 480 months max, grace >= term.
- Tests: existing amortization tests plus UI save fixture.
- Acceptance: payment matches Excel within 1 NIS rounding.

### 5. Mortgage Mix Builder

- Purpose: Build full mortgage composition across Israeli tracks.
- Workflow: Advisor creates N tracks, validates regulation, stress-tests and saves.
- Inputs: mortgage amount, property value, property kind, tracks, rates, CPI, grace.
- Outputs: first/avg/max payment, total interest/indexation/cost, balance curves, regulatory violations.
- Logic: existing aggregate mix engine plus expanded tracks.
- Israeli sources: BOI prime, BOI average rates, CBS CPI, regulatory thresholds.
- Manual vs automatic: suggested values from market snapshot; all track rates manual editable.
- DB: existing `mortgage_scenarios` + `scenario_tracks`.
- Backend/API: existing `save_mortgage_scenario`, extended schema.
- UI: existing mix calculator, add source/freshness badges and assumption drawer.
- CRM integration: action bar calculator; case-linked saves.
- PDF: full client scenario report.
- Permissions: view/use; settings permission for thresholds.
- Edge cases: amount mismatch, more than 12 tracks, linked track without CPI.
- Tests: existing plus market snapshot and source disclosure.
- Acceptance: regulatory blockers match configured thresholds and saved report is reproducible.

### 6. Prime Impact Simulator

- Purpose: Show sensitivity of prime-linked tracks to BOI/prime changes.
- Workflow: Load mix, choose +/− prime deltas or preset, inspect payment shock.
- Inputs: mix, current BOI rate, prime margin, customer margins, change month, deltas.
- Outputs: payment increase, max payment, threshold crossing month, extra cost.
- Logic: rebuild remaining schedule from change month for prime tracks.
- Israeli sources: BOI rate, prime formula.
- Manual vs automatic: BOI automatic, deltas manual.
- DB: `kind='prime_impact'` or included in `scenario` snapshot.
- Backend/API: `simulatePrimeImpact`.
- UI: slider/preset and before/after chart.
- CRM integration: from saved mix.
- PDF: stress scenario section.
- Permissions: view/use.
- Edge cases: negative prime, change month after term, mixed track terms.
- Tests: schedule rebuild fixtures.
- Acceptance: change in prime visibly affects only prime tracks.

### 7. CPI Impact Simulator

- Purpose: Show CPI/indexation risk on linked tracks.
- Workflow: Load mix, set annual CPI path, compare baseline vs stress.
- Inputs: linked tracks, annual/monthly CPI assumptions, start month, horizon.
- Outputs: balance growth, payment impact, total indexation, risk badge.
- Logic: monthly CPI factor `(1 + annualCpi)^(1/12) - 1`; apply to balance before interest.
- Israeli sources: CBS CPI historical and current trend.
- Manual vs automatic: historical automatic; future assumption manual.
- DB: `market_data_snapshots`, `result_snapshot`.
- Backend/API: `simulateCpiImpact`.
- UI: CPI path editor and balance curve.
- CRM integration: from mix builder.
- PDF: CPI sensitivity chart.
- Permissions: view/use.
- Edge cases: deflation, high inflation, unlinked-only mix.
- Tests: CPI-linked golden fixture.
- Acceptance: unlinked tracks show zero indexation.

### 8. Fixed vs Variable Comparison

- Purpose: Compare stability/cost tradeoff between fixed and variable mortgage tracks.
- Workflow: Choose two or more variants; system ranks cost/stability/risk.
- Inputs: track variants, rate-change assumptions, CPI assumptions.
- Outputs: total cost, first/max payment, variability score, breakpoints.
- Logic: run mix aggregate per variant; compute volatility of payment curve and stress delta.
- Israeli sources: BOI/CBS assumptions, regulation thresholds.
- Manual vs automatic: variants manual; assumptions prefilled.
- DB: existing comparison with enhanced result metadata.
- Backend/API: `compareFixedVariable`.
- UI: existing compare page plus risk columns.
- CRM integration: save comparison under case.
- PDF: comparison table.
- Permissions: view/use.
- Edge cases: different amounts/terms, invalid mix in one variant.
- Tests: ranking deterministic; invalid variant blocked.
- Acceptance: output labels "cheapest", "most stable", "highest risk" are deterministic and explainable.

### 9. Spitzer vs Equal Principal Comparison

- Purpose: Compare repayment methods for the same loan.
- Workflow: Advisor selects track/mix and toggles repayment method.
- Inputs: principal, rate, term, CPI, method.
- Outputs: first payment, peak payment, total interest, payment decline curve.
- Logic: existing Spitzer and equal-principal engines.
- Israeli sources: none required; rate assumptions optional.
- Manual vs automatic: manual.
- DB: saved comparison snapshot.
- Backend/API: `compareRepaymentTypes`.
- UI: side-by-side chart/cards.
- CRM integration: can convert track repayment type in mix.
- PDF: repayment-method appendix.
- Permissions: view/use.
- Edge cases: equal-principal first payment too high, zero rate.
- Tests: both methods for same principal/rate.
- Acceptance: equal-principal total interest lower than Spitzer for positive fixed rate.

### 10. Balloon/Bullet Simulator

- Purpose: Model interest-only/grace/bullet structures.
- Workflow: Enter amount, rate, grace months, final repayment assumption.
- Inputs: principal, annual rate, grace months, term, repayment after grace, exit source.
- Outputs: grace payment, final balloon, total cost, refinance risk.
- Logic: interest-only during grace; if partial balloon, amortize remaining term.
- Israeli sources: bank offer manual; no reliable public feed.
- Manual vs automatic: manual bank quote.
- DB: scenario tracks with `repayment_type='balloon'`.
- Backend/API: existing balloon engine extended with terminal balloon.
- UI: warning-heavy editor.
- CRM integration: useful for bridge loans/new property before sale.
- PDF: risk warning and exit assumption.
- Permissions: use_simulators.
- Edge cases: no exit source, grace >= term, CPI-linked balloon balance growth.
- Tests: final balance fixtures.
- Acceptance: report clearly shows remaining principal due.

### 11. Refinance Savings Simulator

- Purpose: Evaluate whether refinancing an existing mortgage is worthwhile.
- Workflow: Enter current loan balances/terms, proposed new mix, costs, early repayment fee.
- Inputs: current tracks, current balance, remaining term, current payment, new tracks, fees, payoff date.
- Outputs: monthly savings, total savings, break-even month, cost after fees, risk change.
- Logic: aggregate current remaining schedule and new schedule; `break_even = total_refi_costs / monthly_savings` when savings positive.
- Israeli sources: BOI average rates for estimate; actual bank payoff manual.
- Manual vs automatic: current bank payoff and fees manual; rates prefill optional.
- DB: `kind='refinance'`, `bank_offers`, `market_data_snapshot`.
- Backend/API: `calculateRefinanceSavings`.
- UI: current-vs-new columns, break-even chart.
- CRM integration: from existing case/mix and uploaded bank documents.
- PDF: refinance recommendation draft with advisor editable conclusion.
- Permissions: view/use; admin not required.
- Edge cases: higher monthly but lower total cost, negative savings, rate reset date.
- Tests: break-even and schedule compare fixtures.
- Acceptance: cannot claim "worthwhile" without showing fees and break-even.

### 12. Early Repayment Penalty Estimator

- Purpose: Estimate early repayment fee and savings for partial/full prepayment.
- Workflow: Advisor selects current track, payoff date, amount, bank fee if known.
- Inputs: current balance, original/current rate, remaining term, linkage, repayment amount, official/reference rate, bank quoted fee.
- Outputs: estimated capitalization fee, admin fees, interest savings, recommended target track.
- Logic: if bank fee provided, use as authoritative; otherwise estimate capitalization delta using BOI average/reference rate bucket and remaining cashflows.
- Israeli sources: BOI average rates/early repayment fee references; bank payoff letter.
- Manual vs automatic: bank payoff manual recommended; official rates automatic/manual import.
- DB: `kind='early_repayment'`, `market_data_snapshot`.
- Backend/API: `estimateEarlyRepaymentPenalty`.
- UI: estimator with explicit "estimate only" badge.
- CRM integration: attach to case and document payoff quote.
- PDF: early repayment analysis with disclaimer.
- Permissions: view/use.
- Edge cases: eligibility loans exempt from early repayment fee, variable reset dates, partial payoff mode.
- Tests: fee zero when reference >= loan rate; manual fee override.
- Acceptance: report labels estimate unless bank quoted fee entered.

### 13. Purchase Tax Simulator

- Purpose: Calculate Israeli purchase tax for property acquisition.
- Workflow: Advisor selects buyer status/profile, purchase date, property value, ownership fraction.
- Inputs: transaction value, date, buyer profile, ownership fraction, replacement-sale plan, new immigrant/disabled flags.
- Outputs: tax due, bracket breakdown, validity period, warnings.
- Logic: progressive bracket calculation from `purchase_tax_brackets`; multiply by ownership fraction where applicable.
- Israeli sources: Israel Tax Authority official simulator/service page.
- Manual vs automatic: bracket table admin curated/imported; advisor inputs profile.
- DB: `purchase_tax_brackets`, scenario snapshot.
- Backend/API: `calculatePurchaseTax`.
- UI: bracket waterfall.
- CRM integration: property/request details.
- PDF: closing-cost tax section.
- Permissions: view/use.
- Edge cases: replacement home sale deadline, mixed rights, foreign resident, land/commercial.
- Tests: official bracket examples, boundary values.
- Acceptance: bracket output matches Tax Authority page for current standard profiles.

### 14. Closing Cost Simulator

- Purpose: Estimate total cash needed beyond equity.
- Workflow: Advisor enters purchase and financing details; defaults fill common Israeli cost categories.
- Inputs: purchase tax, broker fee, lawyer fee, appraisal, opening fee, registration, insurance estimates, renovation, moving, contractor index exposure.
- Outputs: total closing cost, cash-to-close, financing gap.
- Logic: sum fixed/percentage costs; optional construction index escalation for new-build payments.
- Israeli sources: CBS construction index for linked contractor payments; purchase tax engine.
- Manual vs automatic: cost defaults manual office settings; index automatic optional.
- DB: office cost defaults, scenario snapshot.
- Backend/API: `calculateClosingCosts`.
- UI: editable line-item table.
- CRM integration: case request details and financial planning.
- PDF: cash-to-close table.
- Permissions: view/use; settings admin for defaults.
- Edge cases: VAT already included, contractor staged payments, no broker.
- Tests: line-item totals and index escalation.
- Acceptance: all line items are editable and report shows which are estimates.

### 15. Guarantor Impact Simulator

- Purpose: Model how guarantor/supporter income affects affordability and approval.
- Workflow: Add guarantor income/obligations and compare with/without guarantor.
- Inputs: guarantor income, relation, obligations, payment participation, bank ruleset.
- Outputs: DTI before/after, approval probability delta, risk notes.
- Logic: ruleset-defined inclusion percentage of guarantor income; conservative default requires manual bank policy.
- Israeli sources: bank-specific manual rules only.
- Manual vs automatic: manual.
- DB: scenario input snapshot; optional `approval_rulesets`.
- Backend/API: `calculateGuarantorImpact`.
- UI: comparison cards.
- CRM integration: borrower/guarantor role in case.
- PDF: affordability support note.
- Permissions: view/use with borrower PII access.
- Edge cases: guarantor not borrower, limited duration support, conflicting bank policies.
- Tests: ruleset inclusion rates.
- Acceptance: no automatic legal conclusion; only scenario impact.

### 16. Bank Offer Comparison

- Purpose: Compare actual bank offers by cost, risk, flexibility, and compliance.
- Workflow: Advisor enters/upload offers, normalizes tracks, compares side-by-side.
- Inputs: bank, date, expiry, tracks, fees, conditions, discounts, required account/insurance terms.
- Outputs: ranked offers, total cost, first/max payment, risk, gaps, missing fields.
- Logic: run mix aggregate per offer and add qualitative scoring.
- Israeli sources: bank publications/manual offer documents; BOI average rates for benchmark.
- Manual vs automatic: manual bank offer entry; OCR/parser Phase 2.
- DB: `bank_offers`, `bank_offer_tracks`, `documents`.
- Backend/API: `saveBankOfferAction`, `compareBankOffers`.
- UI: bank offer cards, missing-data checklist.
- CRM integration: documents and case banks.
- PDF: offer comparison appendix.
- Permissions: view/use; document permissions.
- Edge cases: expired offer, partial offer, non-comparable term.
- Tests: same offer deterministic ranking, missing required fields.
- Acceptance: advisor can compare at least 2 offers and generate PDF table.

### 17. Best-Bank-Fit Engine

- Purpose: Suggest which Israeli banks are likely best targets for the case based on office knowledge, not live bank approval.
- Workflow: System reads case profile and office rules, advisor sees ranked bank shortlist with reasons.
- Inputs: case type, property city/value, borrower profile, LTV, DTI, bank appetite tags, historical office outcomes.
- Outputs: bank ranking with reason codes and confidence.
- Logic: ruleset + historical office data; no black-box automated decision in MVP.
- Israeli sources: internal office bank rules and offer history; BOI comparison benchmark optional.
- Manual vs automatic: admin maintains bank appetite matrix.
- DB: `bank_fit_rules`, `bank_offer_history` or derived from offers.
- Backend/API: `rankBanksForCase`.
- UI: ranked bank panel with editable notes.
- CRM integration: case bank section.
- PDF: internal only by default; client PDF optional.
- Permissions: managers/advisors; hide internal scoring from clients.
- Edge cases: no history, conflicting rules, bank inactive.
- Tests: deterministic ranking by rules.
- Acceptance: every ranking includes human-readable reason codes.

### 18. Approval Probability Engine

- Purpose: Estimate likelihood of mortgage approval for operational prioritization.
- Workflow: Advisor runs on case; system shows probability band and blockers.
- Inputs: LTV, DTI, credit issues, employment stability, property type, income proof, bank ruleset.
- Outputs: low/medium/high approval band, blockers, next actions.
- Logic: transparent weighted score/rules, not ML at MVP. Enterprise may add trained model only with governance.
- Israeli sources: office experience and bank policies; regulatory thresholds.
- Manual vs automatic: automatic from case fields plus manual risk flags.
- DB: `approval_rulesets`, scenario snapshot, audit for rule changes.
- Backend/API: `calculateApprovalProbability`.
- UI: risk checklist and score explanation.
- CRM integration: case status/SLA/tasks.
- PDF: usually internal; client report should avoid definitive bank decision language.
- Permissions: view/use; admin manages rules.
- Edge cases: missing documents, foreign income, self-employed, guarantor.
- Tests: score bands and reason-code order.
- Acceptance: no unexplained score; every result has blockers/reasons.

### 19. Rent vs Buy Simulator

- Purpose: Compare long-term economics of renting vs buying in Israel.
- Workflow: Enter rent, purchase price, mortgage assumptions, equity return, taxes/costs, horizon.
- Inputs: rent, rent inflation, property value growth, mortgage mix, purchase tax, closing costs, maintenance, investment return on equity, sale costs.
- Outputs: net worth comparison, monthly cashflow difference, break-even year, sensitivity.
- Logic: annual cashflow model with mortgage schedule and asset value assumptions.
- Israeli sources: CPI, purchase tax, optional real-estate comps; all future assumptions manual.
- Manual vs automatic: future growth/rent assumptions manual; historical data optional.
- DB: scenario snapshot and market snapshot.
- Backend/API: `calculateRentVsBuy`.
- UI: long-horizon chart and assumption table.
- CRM integration: pre-qualification/consultation stage.
- PDF: client education report with disclaimer.
- Permissions: view/use.
- Edge cases: negative appreciation, selling before break-even, tax exemptions.
- Tests: cashflow fixtures.
- Acceptance: every assumption is visible and editable.

### 20. Client PDF Scenario Report

- Purpose: Generate polished Hebrew client-facing report from saved snapshots.
- Workflow: Advisor selects saved simulations, edits conclusion, exports PDF.
- Inputs: scenario IDs, client details, advisor conclusion, selected sections.
- Outputs: PDF with assumptions, charts, tables, risks, source/freshness disclosure, disclaimers.
- Logic: render from `result_snapshot` only; never recalculate during PDF export unless advisor explicitly refreshes.
- Israeli sources: all snapshots disclose source/date.
- Manual vs automatic: advisor conclusion manual.
- DB: `mortgage_scenarios`, `market_data_snapshots`, optional `report_exports`.
- Backend/API: `generateMortgageReportPdfAction`.
- UI: report editor with section toggles.
- CRM integration: save generated PDF as document in case.
- PDF: RTL Hebrew, Kaufman branding, black/gold/white, accessible structure.
- Permissions: `view_simulators`; export rate-limited.
- Edge cases: stale data, deleted scenario, missing source, long amortization tables.
- Tests: PDF visual smoke, data snapshot consistency, Hebrew font rendering.
- Acceptance: PDF can be regenerated byte-different but data-identical from saved snapshot.

## Backend Services and Server Actions

### Services

`src/features/market-data/services/market-data.service.ts`

- `getLatestMarketSnapshot(keys)`
- `listMarketDataStatus()`
- `getPurchaseTaxBrackets(date, profile)`
- `upsertMarketDataPoints(sourceKey, points, fetchMeta)`
- `createMarketSnapshot(assumptions)`

`src/features/market-data/services/source-adapters/`

- `boi-rate.adapter.ts`
- `boi-mortgage-rates.adapter.ts`
- `cbs-cpi.adapter.ts`
- `cbs-construction-index.adapter.ts`
- `purchase-tax.adapter.ts`

`src/features/simulators/services/simulation.service.ts`

- `loadScenario(id)`
- `listScenariosForCase(caseId)`
- `saveScenarioSnapshot(payload)`
- `loadCaseSimulationDefaults(caseId)`

### Server Actions

- `saveScenarioAction(payload)`: validate Zod, auth, permission, recalculate server-side, create market snapshot, save header/tracks, audit.
- `deleteScenarioAction(id)`: soft-delete only.
- `refreshMarketDataAction(sourceKey)`: admin only, rate-limited, runs one adapter.
- `saveMarketOverrideAction(sourceKey, point)`: admin only, requires reason.
- `savePurchaseTaxBracketsAction(brackets)`: admin only, full validity-window validation.
- `saveBankOfferAction(payload)`: case edit permission and `use_simulators`.
- `generateMortgageReportPdfAction(payload)`: rate-limited, renders from snapshots, optionally stores document row.
- `saveApprovalRulesetAction(payload)`: admin only, versioned.

### API/Cron Endpoints

- `GET /api/cron/market-data/boi-rate`
- `GET /api/cron/market-data/cpi`
- `GET /api/cron/market-data/construction-index`
- `GET /api/cron/market-data/mortgage-rates`
- `GET /api/cron/market-data/purchase-tax`

Every cron endpoint:

- Requires `CRON_SECRET`.
- Uses timeout per source.
- Is idempotent by `(source_id, series_key, period_start)`.
- Logs success/failure to `market_data_sources`.
- Never deletes historical data.
- Emits stale/failed statuses for UI.

## Data Pipeline

1. Scheduled job calls source adapter.
2. Adapter fetches official API/page with `User-Agent: KaufmanCRM/<version>`.
3. Adapter parses into typed `MarketDataPointInput[]`.
4. Contract validation checks required series, dates, monotonic periods, and numeric ranges.
5. Service writes new points idempotently.
6. Source status updates `last_success_at` or `last_failure_at`.
7. Admin market panel shows current value, last import, freshness, and last error.
8. When a simulation is saved, only the selected values are copied to `market_data_snapshots`.

Caching:

- Market data reads are cached server-side for 5-30 minutes using `unstable_cache` or a service-level cache once measured.
- Saved scenario pages should not depend on live market cache; they render from snapshots.
- Admin refresh bypasses cache.

Retry:

- Cron retry: 3 attempts with exponential backoff inside job.
- If all fail, retain last good value and mark source `failed`.
- No automatic destructive correction.

## UI/UX Screen Specification

### `/simulators`

Hub with cards:

- "תמהיל משכנתא"
- "יכולת מימון"
- "יחס החזר"
- "מס רכישה ועלויות סגירה"
- "השוואת הצעות בנקים"
- "מחזור ופירעון מוקדם"
- "שכירות מול קנייה"

Each card shows whether it can run standalone or works best inside a case.

### `/cases/[id]/simulators`

Case-scoped hub:

- Client header from case.
- Prefill status: income present, property value present, banks/offers present, documents present.
- Saved simulations list with freshness badges.
- CTA to generate client report.

### Calculator Layout

Desktop:

- Right side: inputs in dense operational panels.
- Left side: live results and charts.
- Sticky footer: save, export, reset, assumption source.

Mobile:

- Segmented tabs: inputs/results/report.
- Save button sticky bottom.
- Avoid huge tables; use expandable rows.

### Admin Market-Data Panel

Route: `/settings/simulators/market-data`

Components:

- Source status table.
- Latest values panel.
- Manual override dialog requiring reason.
- Import history.
- Refresh button per source.
- Purchase tax bracket editor with validity ranges.
- Regulatory threshold editor (existing screen can be extended).

## CRM Integration Plan

- Case action bar adds calculator link already present; extend to simulator hub.
- Case financial blocks seed DTI and max mortgage.
- Property/request block seeds LTV, purchase tax, closing costs.
- Documents module stores bank offers and generated reports.
- Tasks can be generated from simulator blockers: missing income proof, LTV breach, expired bank offer, stale tax bracket.
- Audit log records: scenario create/update/delete, PDF export, market override, ruleset change.
- Notifications: stale bank offer, stale market data, saved scenario with outdated assumptions.

## PDF Report Specification

Report sections:

1. Cover: Kaufman branding, client/case, advisor, date.
2. Executive summary: recommended scenario label, advisor conclusion.
3. Assumptions: rates, CPI, property value, income, source/freshness.
4. Mortgage mix: tracks table, regulatory validation.
5. Payment and balance charts.
6. Stress: prime/CPI/fixed-variable impact.
7. Affordability: DTI/LTV/max mortgage.
8. Tax and closing costs.
9. Bank offer comparison.
10. Refinance/early repayment if selected.
11. Disclaimers:
    - "הסימולציה מבוססת על הנתונים שהוזנו ועל מקורות המידע המצוינים בדוח."
    - "אין לראות בדוח אישור בנקאי או התחייבות לריבית."
    - "במקרה של סתירה בין חישוב המס לבין הוראות הדין, הוראות הדין גוברות."

Technical:

- Render from snapshots only.
- Use existing `src/features/simulators/pdf/*`.
- Use chart SVG primitives, not Recharts in PDF.
- Store generated PDF as a case document when advisor chooses.

## Security, Permissions, and Privacy

Permissions:

- `view_simulators`: view hub and saved scenarios.
- `use_simulators`: create/update/delete scenarios and bank offers.
- `manage_simulator_settings`: edit thresholds, market overrides, source settings, rulesets.
- `export_simulator_reports`: optional separate permission if client reports become sensitive exports.

Security controls:

- RLS on every new table.
- Case-linked records inherit case visibility.
- Standalone drafts are `created_by` private.
- Server actions validate auth and authorization before parsing expensive payloads.
- Never return raw DB/API error messages to client.
- Rate-limit PDF export, market refresh, large import.
- No bank/API credentials in client.
- Manual overrides require reason and audit log.
- Generated reports are documents and inherit document permissions.
- No automated approval decision is sent to clients without advisor conclusion.

## Error Handling

User-facing error codes:

- `market_data_stale`
- `market_data_unavailable`
- `invalid_regulatory_mix`
- `missing_case_financials`
- `missing_property_value`
- `source_parse_failed`
- `bank_offer_expired`
- `report_generation_failed`

Rules:

- Calculators remain usable with manual values if a market source fails.
- Save must fail closed if server recalculation or permission check fails.
- PDF generation must show source stale warnings instead of silently using old data.
- Admin panel must expose last failure reason without leaking secrets.

## Prioritized Roadmap

### MVP Hardening and Expansion

1. Market-data foundation: sources, points, snapshots, source status UI.
2. Expand scenario kinds in TS/Zod to match DB.
3. Max mortgage, DTI, LTV, monthly payment.
4. Purchase tax and closing costs.
5. Bank offer manual comparison.
6. PDF report source/freshness disclosure.
7. Admin market-data and purchase-tax settings.

### V2

1. Refinance savings.
2. Early repayment penalty estimator.
3. Guarantor impact.
4. Rent vs buy.
5. Bank offer document parser/OCR assisted extraction.
6. Data freshness notifications and task generation.

### Enterprise

1. Bank-fit engine from historical office outcomes.
2. Approval probability engine with governed rulesets, then optional model.
3. Multi-office market settings and templates.
4. Advanced audit reports for compliance.
5. External client portal for report delivery.

## Test Plan

Domain:

- Golden Excel fixtures for Spitzer, equal-principal, balloon, CPI-linked, prime shock, refinance, purchase tax.
- Boundary tests for every regulation threshold.
- Fuzz tests for amortization closing balance and nonnegative principal.

Data adapters:

- Contract tests with saved official API/page fixtures.
- Parse-failure tests.
- Stale/fallback tests.

Database:

- RLS tests: advisor cannot see another advisor's standalone draft.
- Case-linked scenario follows case visibility.
- Admin-only market override.
- Soft-delete only; no DELETE policy.

Server actions:

- Unauthorized, missing permission, invalid schema, stale source, save success.
- Server recalculation differs from tampered client result and wins.

UI:

- RTL desktop and mobile.
- Live calculation on input change.
- Save disabled for hard regulatory violations.
- Source/freshness badges visible.

PDF:

- Hebrew font render.
- Snapshot data consistency.
- Charts visible.
- Disclaimers present.

Performance:

- Live calculators run client-side under 50ms for typical 12-track/360-month input.
- Save action under 1s excluding network under normal Supabase latency.
- Market-data panel loads latest points in one service call.

## Ticket-Ready Implementation Backlog

### EPIC A: Market Data Foundation

- A1: Create migrations for `market_data_sources`, `market_data_points`, `market_data_snapshots`, RLS, audit triggers.
- A2: Seed BOI, CBS CPI, CBS construction index, purchase tax, BOI mortgage rates sources.
- A3: Implement `market-data.service.ts` with explicit column lists.
- A4: Implement `cbs-cpi.adapter.ts` using CBS index API series `120010`.
- A5: Implement `cbs-construction-index.adapter.ts` after catalog lookup and pinned series ID.
- A6: Implement BOI policy-rate adapter with stable source strategy and parser tests.
- A7: Implement BOI mortgage-rates import adapter or admin CSV importer if no stable feed is exposed.
- A8: Implement source status UI under settings.
- A9: Add `createMarketSnapshot` and attach to scenario save.

### EPIC B: Scenario Type Expansion

- B1: Expand `ScenarioKind` TypeScript and Zod enum.
- B2: Add typed result snapshot discriminated unions.
- B3: Add migration if DB check constraint needs new scenario kinds beyond current list.
- B4: Update saved scenario list labels and i18n.

### EPIC C: Affordability Tools

- C1: Add `max-mortgage.ts` domain + tests.
- C2: Add `dti.ts` simulator domain wrapper + tests.
- C3: Add `ltv.ts` simulator domain wrapper + tests.
- C4: Build `AffordabilitySimulator` UI.
- C5: Add case-scoped route and standalone route.
- C6: Save and PDF integration.

### EPIC D: Tax and Closing Costs

- D1: Create `purchase_tax_brackets` migration/RLS.
- D2: Seed current Tax Authority standard brackets with validity dates.
- D3: Add admin bracket editor.
- D4: Add `purchase-tax.ts` domain + official boundary tests.
- D5: Add `closing-costs.ts` domain + office defaults settings.
- D6: Build tax/closing-cost UI and PDF section.

### EPIC E: Bank Offers

- E1: Create `bank_offers` and `bank_offer_tracks` migrations/RLS.
- E2: Build manual bank offer form.
- E3: Build offer comparison domain using mix engine.
- E4: Attach offer source document.
- E5: PDF offer comparison section.

### EPIC F: Refinance and Early Repayment

- F1: Add current-loan input schema.
- F2: Add refinance savings engine.
- F3: Add early repayment estimator with manual bank fee override.
- F4: Add UI and report sections.
- F5: Add "estimate only" warnings and tests.

### EPIC G: Reports and Compliance

- G1: Add report section selector.
- G2: Add source/freshness disclosure table.
- G3: Store generated report as document.
- G4: Add audit entries for report export.
- G5: Add visual PDF smoke script.

### EPIC H: Bank Fit and Approval Probability

- H1: Create `approval_rulesets` and bank-fit rule tables.
- H2: Build transparent rule engine with reason codes.
- H3: Add internal-only UI.
- H4: Add tasks generated from blockers.
- H5: Add admin versioning and audit.

## Definition of Done for the Platform

- Every simulator listed in this document has a pure domain module and tests.
- Every saved result is reproducible from `result_snapshot`.
- Every automatic market value has source, date, freshness, and override path.
- Every admin override is audited.
- Every route respects RLS and existing CRM permissions.
- PDF reports are Hebrew RTL, source-disclosed, and client-safe.
- The system remains usable when every external data adapter fails.
