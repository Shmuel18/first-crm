# Round 05 Handoff - Case Lifecycle Core, Dashboard, Lists, Case Services

> READ-ONLY REVIEW OUTPUT, now persisted with user approval (2026-06-14).
> Review performed 2026-06-14; approved fixes implemented, tested, committed, and
> deployed the same day.

## 1. Scope Promised

From `docs/REVIEW_PLAN_20_ROUNDS.md`, Round 5:

- `src/features/cases/actions/**`
- `src/features/cases/domain/**`
- `src/features/cases/hooks/**`
- `src/features/cases/schemas/**`
- `src/features/cases/services/**`, except `services/export/**`
- `src/features/cases/types.ts`
- Dashboard, case list, new/edit case, and recycle-bin routes

Focus: lead conversion, draft creation, updates, statuses, advisors, fees,
properties; list filters, sorting, visibility, realtime refresh, soft deletion;
transaction boundaries, optimistic locking, idempotency, error mapping.

## 2. Scope Actually Reviewed

- Full primary scope reviewed statically. `services/export/**` excluded per scope
  (owned by Round 7).
- Authenticated functional smoke (login → create-as-non-`view_all_cases` → edit →
  permissions → case-property → recycle bin) was **run live on Vultr staging** with
  demo accounts and **PASSED** (see §8). It was **intentionally skipped on Kaufman
  prod** — a test case cannot be permanently deleted while retention is paused, so
  it would linger; staging runs the identical build + schema.
- Three areas explicitly not re-read this pass (critic-noted): `calculations.test.ts`
  line-by-line (covered by R5-domain-logic-3); `deleted-cases.service.ts` re-open
  (R5-lifecycle-3 stands); field-by-field diff of `convert_lead_to_case` rich-path
  vs the intake payload schema (mig 151).

## 3. Files Reviewed

- All files under the primary scope globs above.
- `node scripts/check-review-coverage.mjs` passes (zero unassigned files).

## 4. Routes and User Flows Reviewed

| Route or flow | Roles tested | Variants tested | Result | Evidence |
| --- | --- | --- | --- | --- |
| New/edit case + draft create | manager, view-own advisor | he/en (static) | R5-create-draft-1 (High), -2, -3..6 | mig 176; commits fbd5d6d, fb76e0b |
| Lead → case conversion | view-own advisor | — | R5-xcut-1 (High, orphan-on-convert) | mig 176 (trigger covers convert path) |
| Permanent delete + file erasure (recycle bin) | admin | retention paused/enabled | R5-lifecycle-1 (High), -2, -3, -4 | mig 177; erase-case-files; UI banner |
| Inline field edit + fee/status/advisor change | manager, advisor | quick vs full vs inline | R5-update-fee-1 (Medium), -2..5 | mig 178; update-case-field/update-case |
| Additional case properties (associated advisor) | associated advisor | add/edit/remove | R5-advisors-properties-email-1 (Medium) | migs 179-180 |
| Dashboard list + payload | manager, advisor | — | R5-dashboard-list-1/2/3, R5-xcut-5 | cases.service.ts (deferred) |
| Greeting + target-date badges | all | near-midnight, DST | R5-domain-logic-1 (Medium), -2, -3 | Israel-TZ fix; target-date.ts |

## 5. External Contracts Touched

| Contract or resource | Type | Owner round | Expected behavior | Evidence | Status |
| --- | --- | ---: | --- | --- | --- |
| `cases` INSERT | trigger | 5 | New case auto-assigned to creator unless they hold `view_all_cases` (covers create + lead-convert) | mig 176 `set_case_default_advisor` | Verified (structs + behavioral, both deployment targets; live UI smoke on Vultr) |
| `permanently_delete_case` RPC | RPC | 5 | Refuses with `PT001` for end-users while `retention_purge_enabled=false`; service_role/SQL recovery open | mig 177 | Verified (pgTAP + behavioral) |
| `erasure_orphan_log` | table + CHECK | 5/10 | Durable record per leaked Storage/Drive pointer (incl. the case folder, entity `'case'`) on erase failure | mig 177 CHECK extended; erase-case-files | Verified (unit tests) |
| `cases` UPDATE | trigger | 5 | End-users may change `status_id` only with `change_case_status`, `assigned_advisor_id` only with `assign_case_to_user` — enforced only when the value actually changes | mig 178 `guard_case_trusted_columns` | Verified (behavioral) |
| `case_properties` INSERT/UPDATE + `soft_delete_case_property` | RLS + RPC + trigger | 5 | Authority via `can_edit_case` (associated advisors allowed); `created_by`/`updated_by` un-forgeable; `created_by` write-once | migs 179-180 | Verified (pgTAP + behavioral) |

## 6. Findings

Tally: **2 High, 5 Medium, ~20 Low** (26 canonical + a 7-entry cross-cutting
`xcut` synthesis layer; xcut-1..5 restate canonical High/Medium findings, xcut-6
is a new Low, xcut-7 is a meta-note). Statuses reflect post-fix state.

| ID | Severity | Status | Owner | Verif. | Summary |
| --- | --- | --- | ---: | ---: | --- |
| R5-create-draft-1 | High | Fixed | 5 | 19 | New draft case created with NULL `assigned_advisor_id` → invisible + uneditable (404) to a view-own-only creator |
| R5-lifecycle-1 | High | Fixed | 5 | 10,19 | Manual permanent-delete bypassed the retention master switch — hard-deleted case + files while legally-mandated purges were paused |
| R5-create-draft-2 | Medium | Fixed | 5 | — | `clearDirty()` ran before the save transition → a FAILED save left the draft un-guarded, silently losing unsaved borrower data |
| R5-lifecycle-2 | Medium | Fixed | 5 | 10 | Permanent-delete file erasure didn't log orphaned Storage/Drive pointers on failure (unlike the cron path); ref collection swallowed read errors |
| R5-update-fee-1 | Medium | Fixed | 5 | 19 | Granular `change_case_status`/`assign_case_to_user` bypassable via `updateCaseFieldAction` & `updateCaseAction` (only quick-update enforced) |
| R5-advisors-properties-email-1 | Medium | Fixed | 5 | 19 | Associated advisors could open the properties UI but every add/edit/remove silently failed (action gate vs table RLS mismatch) |
| R5-domain-logic-1 | Medium | Fixed | 5 | — | Greeting + target-date used the server (UTC) clock, not Israel TZ; SSR/filter vs client badge disagreed near midnight |
| R5-create-draft-3 | Low | Deferred | 5 | — | Duplicate borrower (same national_id) in one draft silently dropped (ON CONFLICT DO NOTHING) |
| R5-create-draft-4 | Low | Deferred | 5 | — | User-facing 'setup' error leaks a stale internal migration number (says 074; live RPC is 142) |
| R5-create-draft-5 | Low | Deferred | 5 | — | `saveCaseDraftAction` (the only live create path) has no `checkRateLimit` |
| R5-create-draft-6 | Low | Deferred | 5 | — | Dead code: `createCaseAction` + `CaseForm mode==='create'` branch unreachable (insert + compensating-delete) |
| R5-update-fee-2 | Low | Deferred | 5 | — | Edit-case page renders the full edit form (even for non-editors) without an upfront `userCanEditCase` gate |
| R5-update-fee-3 | Low | Deferred | 5 | 9 | `case_financials` fee writes have no optimistic-lock/CAS → concurrent manager edits last-write-wins |
| R5-update-fee-4 | Low | Deferred | 5 | — | Inline single-field edits skip the cross-field rule (mortgage ≤ property) the full form enforces |
| R5-update-fee-5 | Low | Deferred | 5 | — | Inline-edit server actions exceed the 100-line file limit |
| R5-lifecycle-3 | Low | Fixed | 5 | — | Recycle-bin "purge in N days" countdown (+ red warning) misleading while the automated purge is paused |
| R5-lifecycle-4 | Low | Deferred | 5 | — | `permanentDeleteCaseAction` (Storage + Drive external calls) is not rate-limited |
| R5-advisors-properties-email-2 | Low | Deferred | 5 | — | `savePurpose` issues two non-atomic property updates; second-call failure leaves a partial write while the client reverts both |
| R5-advisors-properties-email-3 | Low | Deferred | 5 | 13 | `addAssociatedAdvisorAction` doesn't verify advisorId is an active advisor (only FK to profiles) — Suspected, not an IDOR (xcut-7) |
| R5-advisors-properties-email-4 | Low | Deferred | 5 | — | `is_responsible` error collapses to a generic 'saveFailed' toast |
| R5-advisors-properties-email-5 | Low | Deferred | 5 | — | Pure domain helper `resolveAdvisorName` has no unit test |
| R5-domain-logic-2 | Low | Fixed | 5 | — | 'soon' (≤7 days) window added a fixed 7×DAY_MS across DST → off-by-one on the 7th day twice a year |
| R5-domain-logic-3 | Low | Deferred | 5 | — | DTI/LTV/sort tests cover happy paths only (miss negative value, LTV>100, NaN dates, multi-primary borrower) |
| R5-dashboard-list-1 | Low | Deferred | 5 | 14 | Manager-only fee (`case_financials`) shipped to the browser in the dashboard list payload it never displays |
| R5-dashboard-list-2 | Low | Deferred | 5 | — | Dashboard list over-fetches and ships unused heavy columns/embeds to client components |
| R5-dashboard-list-3 | Low | Deferred | 5 | — | Dead code: `getCaseViewCounts` superseded by the bootstrap RPC but still exported |
| R5-xcut-1 | High | Fixed | 5 | 19 | (cross-ref of create-draft-1) Lead→case conversion creates an orphaned NULL-advisor case; lead consumed, can't retry |
| R5-xcut-2 | Medium | Fixed | 5 | 19 | (cross-ref of advisors-properties-email-1) `case_properties` RLS (mig 156) omits associated advisors but actions gate on `userCanEditCase` |
| R5-xcut-3 | Medium | Fixed | 5 | 19 | (cross-ref of update-fee-1) status/assign enforced by only 1 of 3 sibling case-update actions |
| R5-xcut-4 | High | Fixed | 5 | 10,19 | (cross-ref of lifecycle-1) manual permanent-delete + erasure bypasses the retention master switch (mig 173) |
| R5-xcut-5 | Low | Deferred | 5 | 14 | (cross-ref of dashboard-list-1) manager-only fee over-fetched + serialized to clients that never render it |
| R5-xcut-6 | Low | Deferred | 5 | 12 | NEW: `sendClientEmailAction` (advisor-initiated client email) has no `checkRateLimit` unlike other outbound actions |
| R5-xcut-7 | Low | Note-only | 5 | — | Meta-note: re-classified advisors-properties-email-3 Suspected→Verified (Low), explicitly NOT an IDOR |

## 7. Proposed Fixes and Regression Tests — as shipped

| Finding ID(s) | Fix (shipped) | Affected files | Migration | Regression test | Commit |
| --- | --- | --- | --- | --- | --- |
| R5-create-draft-1 / xcut-1 | BEFORE INSERT trigger: auto-assign creator unless `view_all_cases` (covers create + lead-convert) | `cases` | **176** | `supabase/tests/case_create_advisor_test.sql` (pgTAP) | fbd5d6d |
| R5-lifecycle-1 / xcut-4 | `permanently_delete_case` raises `PT001` while paused; recycle-bin UI banner + disabled action | `permanent-delete-case.ts`, `recycle-bin-list.tsx` | **177** | `case_permanent_delete_retention_test.sql` (pgTAP); `permanent-delete-case.test.ts` | 8c14a18 |
| R5-lifecycle-2 | `collectCaseFileRefs` fail-closed (abort delete on any read error); durable `erasure_orphan_log` rows per leaked Storage/Drive pointer incl. the case folder | `erase-case-files.ts`, `permanent-delete-case.ts` | **177** (CHECK) | `erase-case-files.test.ts` (8 cases); `permanent-delete-case.test.ts` | 8c14a18 |
| R5-lifecycle-3 | Recycle bin shows all + no countdown + paused banner when retention off | `deleted-cases.service.ts`, `recycle-bin/page.tsx`, `recycle-bin-list.tsx` | — | (covered by service shape) | 8c14a18 |
| R5-update-fee-1 / xcut-3 | BEFORE UPDATE trigger enforces status/assign perms only-when-changed; action-level granular gates | `update-case-field.ts`, `update-case.ts` | **178** | `case_trusted_columns_test.sql` (pgTAP) | 131a638 |
| R5-advisors-properties-email-1 / xcut-2 | Route case_properties INSERT/UPDATE + `soft_delete_case_property` through `can_edit_case`; created_by/updated_by anti-forgery; created_by write-once trigger; 0-row check on UPDATE | `update-case-property-field.ts` + RLS | **179, 180** | `case_properties_authority_test.sql` (pgTAP, plan 5) | cbe3c5f |
| R5-create-draft-2 | Removed pre-save `clearDirty()` so a failed save keeps the dirty guard | `new-case-page-client.tsx` | — | — | fb76e0b |
| R5-domain-logic-1 / -2 | Israel-TZ anchoring (`israelCivil` via Intl Asia/Jerusalem); calendar-day soon-window (DST-safe) | `greeting.ts`, `target-date.ts`, `israel-time.ts` (new) | — | `greeting.test.ts`, `israel-time.test.ts`, `target-date.test.ts` | fb76e0b |

### Reviewer-caught follow-ups (3, before commit — see §11)
1. `case_properties.created_by` immutable — RLS WITH CHECK can't see OLD → added
   **mig 180** trigger + pgTAP forging `created_by` on UPDATE (expects 42501).
2. `collectCaseFileRefs` was swallowing read errors → made **fail-closed**
   (returns `{ok:false}`; caller aborts the delete) + unit tests.
3. Claimed "4 pgTAP" but only 3 existed → added the retention pgTAP
   (`case_permanent_delete_retention_test.sql`).

## 8. Read-Only Commands Run and Commands Requiring Approval

| Command | Run or proposed | Result |
| --- | --- | --- |
| `node scripts/check-review-coverage.mjs` | Run | Pass, zero unassigned |
| `vitest run` (post-fix) | Run (approved) | **368 passing** |
| `tsc --noEmit` / `eslint` (post-fix) | Run (approved) | Clean (0 errors, 0 warnings) |
| migs 176-180 apply to **uknsayoyvffkxamofczy** (Kaufman prod, node+pg) | Run (approved) | schema 175→180; 7 struct checks PASS |
| migs 176-180 apply to **eyujzasggzjocsxakkoi** (Vultr staging, node+pg) | Run (approved) | schema 175→180; 7 struct checks PASS |
| Behavioral proofs (node+pg, rolled-back transactions, dev) for migs 176-180 | Run | Pass (no local supabase stack for `supabase test db`) |
| Vercel deploy verify (deep-health build flip + schema 180/180) | Run | build fb76e0b live; applied=expected=180 |
| Vultr deploy `SKIP_MIGRATIONS=1` (build fb76e0b) | Run (approved) | live + healthy; deep-health schema 180/180 |
| **Authenticated functional smoke on Vultr staging (demo accounts)** | Run (approved) | **PASS** (see live-smoke table below) |

### Live functional smoke — Vultr staging (2026-06-14, demo accounts)

| # | Check | Account | Result |
| --- | --- | --- | --- |
| 1 | Login | demo.advisor (junior, no view_all_cases) + demo.admin (manager) | PASS — advisor saw 18 cases, manager 57 + statistics nav; Israel-TZ greeting "בוקר טוב" rendered |
| 2 | Create case as non-`view_all_cases` user (R5-create-draft-1) | demo.advisor | PASS — case `2026-065` opened visible+editable (not a 404 orphan); DB: `assigned_advisor`=`created_by`=demo.advisor (mig 176 trigger + anti-forgery) |
| 3 | Edit case (R5-update-fee-1 path) | demo.advisor | PASS — status → `document_collection` persisted (DB-confirmed; mig 178 trigger allows the authorized advisor) |
| 4 | Permissions | demo.advisor | PASS — manager-only `שכר טרחה`/`הכנסה צפויה` absent from the מנהלה block; recycle-bin route admin-only (junior redirected to /settings/profile) |
| 5 | Case property (R5-advisors-properties-email-1) | demo.advisor | PASS (authority) — write to `case_properties` succeeds, `updated_by`=demo.advisor (pre-fix = silent RLS deny); add/edit-property UI present. Inline masked-input *values* not drivable via synthetic typing (harness limit; value-persistence covered by pgTAP) |
| 6 | Recycle bin (R5-lifecycle-1 + R5-lifecycle-3) | demo.admin | PASS — amber paused banner shown, no purge countdown, "show all"; "permanently delete now" disabled (click = no-op, case survives) |

Cleanup: the QA test case `2026-065` + its borrower were removed from Vultr staging via direct SQL afterwards. Demo-account passwords on staging were normalized to a known QA value via the established service-role mechanism.

## 9. Contracts Proposed as Confirmed

- None proposed as fully confirmed. C-005 **closed for the fixed paths**, partially
  open for deferred Lows + final R19 DB re-verification (see §10).

## 10. Contracts Requiring Later Verification

| Contract ID | Owning round | Required verification | Why it remains open |
| --- | ---: | --- | --- |
| C-005 | 5 | R6/8-10/14 verify consumers; R17-19 verify final DB behavior; R20 verifies workflows | Fixed paths closed (migs 176-180); deferred Lows (inline cross-field rule, fee lost-update, over-fetch of manager-only data) unresolved; final RLS/trigger grants re-verified in R19 |

## 11. Residual Risks and Blocked Work

- **Vultr connected demo-account smoke: DONE — PASSED** (2026-06-14) on all six
  areas (login / create-as-non-view_all / edit / permissions / case-property /
  recycle bin). See the live-smoke table in §8. Task closed.
- **Authenticated functional smoke on Kaufman prod: intentionally skipped.**
  Running it would create a prod test case that cannot be permanently deleted
  while retention is paused (it would linger). The same flows are verified on
  Vultr staging (identical build + schema). If the operator wants prod coverage,
  do a manual click-through in the live UI. (Owner: user — accepted skip)
- **Deferred Lows** (note-only, not fixed): all R5 Lows except R5-lifecycle-3 and
  R5-domain-logic-2. Notable for later rounds: R5-update-fee-3 (fee lost-update,
  R9), R5-dashboard-list-1/2 + xcut-5 (over-fetch of manager-only data, R14),
  R5-xcut-6 (client-email rate-limit, R12), R5-advisors-properties-email-3 (active-
  advisor check, R13).

## 12. Instructions for the Next Round

- Round 6 (case workspace UI + orchestration) must verify the workspace composes
  the now-fixed lifecycle without leaking the deferred over-fetched fields
  (R5-dashboard-list-1/2, xcut-5) into client components, and re-check that the
  edit page gates on `userCanEditCase` (R5-update-fee-2).
- Round 9 owns the fee optimistic-lock gap (R5-update-fee-3); Round 10 re-verifies
  erasure/orphan-log behavior (R5-lifecycle-2); Round 13 owns the active-advisor
  check (R5-advisors-properties-email-3); Round 14 owns the manager-only over-fetch.
- Round 19 re-verifies the final state of triggers/RLS from migs 176-180.
