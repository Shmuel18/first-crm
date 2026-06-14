# Round 06 Handoff - Case Workspace UI and Case-Level Orchestration

> READ-ONLY REVIEW OUTPUT, persisted with user approval (2026-06-14).
> Review performed 2026-06-14 (multi-agent workflow); approved fixes
> implemented, tested, committed (`aceb724`), and deployed the same day.

## 1. Scope Promised

From `docs/REVIEW_PLAN_20_ROUNDS.md`, Round 6:

- `src/features/cases/components/**`
- Main case-detail route and loading state

Focus: workspace composition, inline editing, block preferences, action
controls; correct-case isolation + role-specific field visibility; loading /
empty / error / mobile / RTL / destructive states; cross-feature contracts with
borrowers, financials, tasks, comments, and docs.

## 2. Scope Actually Reviewed

- All **50 files**: 47 in `src/features/cases/components/` + `cases/[id]/page.tsx`,
  `[id]/loading.tsx`, `[id]/edit/page.tsx`. (`cases/page.tsx`, `cases/new/*` are
  Round 5's; touched here only to wire the dashboard edit gate.)
- Method: 5 dimension reviewers (detail/compose · inline-actions · dashboard-list
  · draft-flow · cross-cutting sweep) → adversarial refute pass per finding.
  22 raw findings → **19 confirmed, 3 refuted** (27 agents).
- `node scripts/check-review-coverage.mjs` passes (zero unassigned).
- Dynamic/visual AT verification was static-only at review time; a live
  functional smoke of the new edit gate was run on Vultr staging afterward (§8).

## 3. Files Reviewed

- All 50 files in the Round-6 scope above. Coverage check passes.

## 4. Routes and User Flows Reviewed

| Route or flow | Roles | Result | Evidence |
| --- | --- | --- | --- |
| Case detail compose + inline edit | manager, view-own advisor, view-only | R6-inline-actions-1 (Medium) + dead-code/polish | mig 147 can_edit_case; commit aceb724 |
| Dashboard list/table/cards inline cells | manager, advisor, view-only | R6-dashboard-list-1/2/4 + edit-gate wiring | aceb724 |
| New-case draft flow | advisor | R6-draft-flow-1..6 | static read |

## 5. External Contracts Touched

| Contract or resource | Type | Owner | Expected behavior | Status |
| --- | --- | ---: | --- | --- |
| `can_edit_case` RPC (mig 147) | RPC | 1/5 | Authority for every case-detail edit affordance; UI now gates on it | Consumed by R6 fix |
| `change_case_status` / `assign_case_to_user` | permissions | 5 | Required ON TOP of edit authority for status / advisor (DB trigger mig 178) | UI now composes both |
| `view_all_cases` (canViewAll) | permission | 3/5 | VISIBILITY scope only — never an edit gate (R6 corrected the dashboard) | Clarified |

## 6. Findings

Tally (post-verification): **0 High, 1 Medium, 18 Low.** "Fixed" = shipped in
`aceb724`; "Deferred" = tracked for a later round / left out of this batch.

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| R6-inline-actions-1 | Medium | **Fixed** | Case-detail page had NO `userCanEditCase` gate → view-only users (e.g. secretary with view_all on an unassigned case) saw ALL edit affordances (borrowers / request-details / property / case-details / banks+expenses / status+advisor) that fail at the server. Originally scoped to status/advisor cells; **expanded** to the whole page on user review. |
| R6-detail-compose-1 | Low | **Fixed** | Dead `case-info-rows.tsx` (+ now-dead schema color consts) — deleted |
| R6-detail-compose-2 | Low | **Fixed** | Dead `case-detail-helpers.tsx` + stale comment — deleted/fixed |
| R6-detail-compose-3 | Low | **Fixed** | `[id]/loading.tsx` skeleton (6 blocks, 2-col) didn't match the real page (7 full-width) → reflow flash; now mirrors 7 full-width |
| R6-inline-actions-3 | Low | **Fixed** | `generate-bank-pdf` returned + toasted raw `error.message`; now logged server-side, generic translated toast |
| R6-inline-actions-4 | Low | **Fixed** | Target-date popover lacked the resize→close listener the other cells have; added |
| R6-inline-actions-5 | Low | **Fixed** | `CaseStatusBadge.interactive` prop + ChevronDown branch dead — removed |
| R6-dashboard-list-1 | Low | **Fixed** | Welcome-banner date used UTC, not Israel TZ (greeting already Israel-anchored); pinned to Asia/Jerusalem |
| R6-dashboard-list-4 / R6-crosscut-1 | Low | **Fixed** | Sort-control trigger used `↑/↓` glyphs; now Lucide ArrowUp/ArrowDown + worded aria-label (one fix, two reviewers) |
| R6-draft-flow-4 | Low | **Fixed** | Dead `clearDirty` action/callback after the R5-create-draft-2 fix + stale comment — removed |
| R6-inline-actions-6 | Low | Deferred | Hardcoded `Ctrl+Enter`/`Esc` literals in the note hint. Its only home is `messages/*.json`, co-mingled with a parallel agent's email-attachments commit — deferred to avoid a tangled commit |
| R6-inline-actions-7 | Low | Deferred | Status label hardcoded `name_he` (Hebrew labels in EN). Duplicate of tracked **DSGN-i18n-status-labels** |
| R6-dashboard-list-2 | Low | Deferred | Manager-only `case_financials` over-fetched into the dashboard list payload (manager's own browser, not a cross-user leak). Duplicate of deferred **R5-dashboard-list-1** |
| R6-draft-flow-1 | Low | Deferred | `draft-borrower-card.tsx` 283 lines (>250). File-split |
| R6-draft-flow-2 | Low | Deferred | `case-form.tsx` 259 lines (>250). File-split |
| R6-draft-flow-3 | Low | Deferred | `CaseForm` create-mode branch + `createCaseAction` unreachable. Duplicate of deferred **R5-create-draft-6** |
| R6-draft-flow-5 | Low | Deferred | Returning-client amber overwrite-flag only on 7 of the fillable fields (4 visible misc/citizenship fields unflagged). Needs Round-8 borrower compact-field threading |
| R6-draft-flow-6 | Low | Deferred | "setup" error shows a developer "run migration 074" message to advisors. Duplicate of deferred **R5-create-draft-4**; practically unreachable behind the schema gate |

### Refuted (3) — correctly rejected by the verify pass
| ID | Claim | Why refuted |
| --- | --- | --- |
| R6-detail-compose-4 | CaseBlock captures saved open/closed pref only on mount | Intentional: prefs are page-stable server data; re-syncing would yank sections open under the user. NotABug |
| R6-inline-actions-2 | Delete confirm in `AlertDialogCancel` defeats the pending guard | `AlertDialogCancel` and `AlertDialogAction` both alias the same `Close`; auto-dismiss-on-confirm is the codebase pattern; idempotent soft-delete + `isPending` guard cover double-fire. NotABug |
| R6-dashboard-list-3 | National-id on mobile card lacks `<bdi>` LTR isolation | Unreachable: `isValidIdOrPassport` rejects all separators, so a neutral-free `[A-Za-z0-9]` run can't bidi-reorder |

## 7. Proposed Fixes and Regression Tests — as shipped (`aceb724`)

| Finding(s) | Fix | Key files | Test |
| --- | --- | --- | --- |
| R6-inline-actions-1 | Page computes `canEditCase` (can_edit_case RPC) + `canChangeStatus`/`canAssignAdvisor`; threaded to every edit surface (borrowers via disabled `<fieldset>`, request-details, property+additional+purpose, case-details fields, banks+expenses, status/advisor cells). Read-only modes added to `EditableField`, the 4 inline cells, the bank cell, the purpose picker, and `RichTextEditor` (`editable` prop). Dashboard gated by a per-row `CaseEditGate` (NOT `canViewAll`) | `cases/[id]/page.tsx`, `cases/page.tsx`, `case-details-section`, `case-admin-block`, `case-property-block`, `case-additional-properties`, `property-fields`, `transaction-purpose-picker`, `case-request-details-block`, editable-{status,advisor,text,target-date,bank,field} cells, `case-table-row`, `case-card`, `cases-table`, `cases-card-list`, `case-action-bar`, `add-borrower-button`, `rich-text-editor`, `domain/case-edit-gate.ts` | `domain/case-edit-gate.test.ts` (7 cases incl. view-only secretary) |
| dead-code (detail-1/2, inline-5, draft-4) | deletions + stale-comment fixes | `case-info-rows` (del), `case-detail-helpers` (del), `case.schema.ts`, `case-status-badge`, `use-case-draft-state` | tsc/lint |
| polish (detail-3, inline-3/4, dash-1, dash-4) | skeleton 7-block, pdf error code, resize-close, Israel-TZ date, Lucide sort icon | `loading.tsx`, `generate-bank-pdf.{tsx,button}`, `editable-target-date-cell`, `dashboard-welcome-banner`, `cases-sort-control` | — |

Verification: **tsc 0, lint 0, vitest 375**. No migration (schema stays 180).

## 8. Read-Only Commands Run + Authorized Runs

| Command | Result |
| --- | --- |
| Round-6 review workflow (5 reviewers + verify, 27 agents) | 22→19 confirmed / 3 refuted |
| `node scripts/check-review-coverage.mjs` | Pass, zero unassigned |
| `tsc --noEmit` / `eslint` / `vitest run` (post-fix) | Pass; 375 tests |
| commit `aceb724` (35 files; parallel email-attachments `8962f4b` + `task-form-dialog.tsx` excluded) → push `main` | build aceb724 live on Vercel; /api/health 200; schema 180/180 |
| Vultr staging deploy (`aceb724`, `SKIP_MIGRATIONS=1`) + live functional smoke (demo accounts) | see Round-6 row in MASTER_LEDGER Authorized Test Runs |

## 9. Contracts Proposed as Confirmed

- None fully confirmed. C-006 advanced (see §10) — composition is sound; the
  affordance gap (R6-inline-actions-1) is closed.

## 10. Contracts Requiring Later Verification

| Contract ID | Owning round | Required verification | Why open |
| --- | ---: | --- | --- |
| C-006 | 6 | R8-14 verify embedded domains; R20 verifies the workspace end-to-end | Composition sound; edit-affordance gate now matches DB authority (aceb724). Incomes/obligations edit gate NOT yet wired (full-width grid items — R8/R9); manager-only over-fetch (R6-dashboard-list-2) deferred |

## 11. Residual Risks and Blocked Work

- **Incomes / obligations blocks** still render edit controls for view-only users
  (server/RLS blocks the write). Not wired in this batch — they're full-width grid
  items where a page-level `<fieldset>` would break `col-span`; gate at the
  block level in R8/R9. (Low — same UX-honesty gap, server-enforced.)
- **Edit route** (`cases/[id]/edit/page.tsx`, R6-update-fee-2 — R5 ID family) has
  no upfront `userCanEditCase` gate; deferred.
- **Deferred Lows**: file-splits (draft-flow-1/2), documented duplicates
  (inline-7, dashboard-2, draft-3/6), amber-flag (draft-5), i18n hint (inline-6).
- **Parallel-agent hazard (recurring):** an email-attachments feature was
  committed (`8962f4b`) into the shared working tree mid-session and
  `task-form-dialog.tsx` carried a pre-existing uncommitted edit — the Round-6
  commit staged ONLY its own 35 files. Always re-check `git status` before
  committing here.

## 12. Instructions for the Next Round

- Round 7 (PDFs/reports/exports) is the next scope.
- R8 (borrowers) should pick up: incomes-block edit gate, R6-draft-flow-5
  (amber-flag through borrower compact-fields), draft-borrower-card file-split.
- R9 (case-banks/expenses): obligations-block edit gate + R6-update-fee-3 family.
- Round 19 re-verifies the final state of `can_edit_case` + the dashboard gate.
