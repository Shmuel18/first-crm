# Round 08 Handoff - Borrowers, Identity, and Income

> READ-ONLY REVIEW OUTPUT, persisted with user approval (2026-06-14).
> Review 2026-06-14 (multi-agent workflow). Authorization-layer fixes
> implemented + behaviorally proven; awaiting push/deploy approval (NOT pushed).

## 1. Scope Promised

From `docs/REVIEW_PLAN_20_ROUNDS.md`, Round 8:

- `src/features/borrowers/**`
- `src/features/incomes/**`
- Borrower create/edit routes

Focus: returning borrowers, national IDs, identity matching, cross-case
isolation; income totals/dates/schemas/optimistic-locking/soft-deletion;
multi-borrower behavior + consistency with case/simulator data.

## 2. Scope Actually Reviewed

- All **51 files** (34 borrowers + 15 incomes + 2 routes). Coverage clean.
- Method: 5 dimension reviewers (borrower actions/RLS · borrower UI · borrower
  domain/hooks · incomes · routes + cross-cutting) → adversarial verify.
  **23 raw → 18 confirmed / 5 refuted** (28 agents).
- **Synthesis catch:** two verifiers raised, as an aside, that the inline
  add-borrower path's direct INSERT is RLS-blocked for non-admins; the lead
  verified it against the policy/role config and **elevated it to High** (the
  workflow itself had filed only the atomicity symptom as Low).

## 3. Findings

Tally (post-verification + synthesis): **1 High, 1 Medium, ~13 Low.**

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| R8-add-borrower-rls (synthesis-elevated; workflow filed the atomicity as R8-borrower-actions-2/Low) | **High** | **Fixed** | `addEmptyBorrowerAction` did a direct `borrowers` INSERT; `borrowers_modify` (mig 064) restricts that to `edit_any_case`, so a **junior advisor on their own case** passed `userCanEditCase` then got RLS-denied → the inline "+ add borrower" silently failed for the most common role. (Case *creation* worked via the SECURITY DEFINER draft RPC; only inline add-to-existing was broken.) |
| R8-routes-crosscut-1 | **Medium** | **Fixed** | `/cases/[id]/borrowers/new` + `/.../[borrowerId]/edit` rendered the fully-editable BorrowerForm to view-only users (no `userCanEditCase` gate) — same class as R6-inline-actions-1, which missed these two standalone routes. |
| R8-incomes-1/2 (= routes-crosscut-2) | Low | Deferred | Dead legacy dialog income flow (`income-form-dialog.tsx` + `save-income.ts` + `getIncomeById` + `IncomeInsert`/`IncomeActionState`/`INCOME_ACTION_INITIAL`) orphaned by the inline-edit migration (~265 lines). |
| R8-borrower-ui-2 | Low | Deferred | Hardcoded `'שמירה נכשלה'` toast fallback in `editable-field.tsx` → should use `tc('saveFailed')`. |
| R8-borrower-ui-3 | Low | Deferred | Hardcoded `'— בחר —'` select placeholder in `editable-field-control.tsx` (reached by income-row + case-details selects). |
| R8-borrower-ui-4 | Low | Deferred | Citizenship/residency toggles never re-sync from props → stale after a sibling-save revalidate (add the propRef sentinel used elsewhere). |
| R8-borrower-ui-5 | Low | Deferred | Compact borrower fields (children/language/citizenship/residency) swallow save failures → no error toast. |
| R8-borrower-ui-6 | Low | Deferred | Select chevron pinned physical-left with logical `pe-*` → wrong side in English/LTR (also CompactSelect, CompactToggle). |
| R8-borrower-actions-1 (= domain-3) | Low | Deferred | Returning name-search doesn't escape LIKE `%`/`_` (precision only — RLS-scoped, not injection). |
| R8-borrower-domain-1 | Low | Deferred | Returning-lookup effect can drop an in-flight result (stale-closure: `criteria` new object each render + `queried.add(key)` before the await). |
| R8-borrower-domain-4 | Low | Deferred | No tests for the `isEditableBorrowerField` whitelist + the 3 returning hooks (defense-in-depth; DB enforces independently). |
| R8-incomes-3 | Low | Deferred | `save-income.ts` swallows DB errors with no log (moot — file is dead code, to be deleted). |
| R8-incomes-4 | Low | Deferred | `delete-income.ts` logs inline instead of via `safeDbError` (consistency). |
| R8-borrower-ui-1 (= routes-crosscut-3) | Low | Deferred | `case-borrower-card.tsx` 302 lines (>250) — file-split. |

### Refuted (5 — high-quality)
| ID | Why refuted |
| --- | --- |
| R8-borrower-actions-3 | `error.message` is the documented SAFE log field; suggested "log full err" was counterproductive. |
| R8-borrower-actions-4 | No-Zod-on-caseId: siblings don't either; `can_edit_case` RPC fails closed on a bad uuid; matches convention. |
| R8-borrower-domain-2 | Returning ID threshold (6) vs storage min (4): intentional, documented "don't fire on half-typed IDs". |
| R8-borrower-domain-5 | 32-char nationalId probe cap: harmless loose input cap (self-labeled); RLS + rate-limit neutralize. |
| R8-routes-crosscut-4 | add-empty >100 lines: 67 code lines (rest comments/blank); the real issue is the High/atomicity, fixed. |

## 4. Fixes Implemented (the authorization layer — "where the meat is")

**Migration 190** (`190_canonical_can_edit_case_borrower_income_writes.sql`) — canonicalizes ALL borrower + income/obligation write authorization on `public.can_edit_case` / `public._assert_can_edit_case` (which include associated advisors, mig 147), replacing the legacy `assigned_advisor_id = actor OR edit_any_case`:
- `update_borrower_in_case` → `_assert_can_edit_case` (was mig 076's inline check).
- `save_borrower_for_case_full` → `_assert_can_edit_case` (was mig 123; keeps the optimistic-lock `p_expected_version` contract).
- **NEW** `add_empty_borrower_to_case(p_case_id)` — atomic SECURITY DEFINER RPC: `_assert_can_edit_case` → insert borrower → insert junction → primary-sync, all in one transaction (no orphan on partial failure; works for non-admin/associated advisors).
- `soft_delete_borrower_income` / `soft_delete_borrower_obligation` → `_assert_can_edit_case` (+ borrower-on-case check).
- `incomes_insert`/`incomes_update` **and** `obligations_insert`/`obligations_update` RLS policies → `public.can_edit_case(cb.case_id)` (obligations fixed proactively — identical legacy pattern; full R9 review still owns obligations).

**Code:**
- `addEmptyBorrowerAction` → calls `add_empty_borrower_to_case` RPC (dropped the 3 direct writes); maps `42501`→`unauthorized`.
- `cases/[id]/borrowers/new` + `[borrowerId]/edit` → `userCanEditCase` gate → `notFound()` for view-only users.

**Safe by construction:** `can_edit_case`/`_assert_can_edit_case` are a SUPERSET of the legacy check, so this only WIDENS to associated advisors + restores responsible-advisor inline-add — it never grants a user who lacked edit authority.

## 5. Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` / `eslint` | 0 errors / 0 warnings |
| `vitest run` | 388 passed |
| `next build` | (see ledger Authorized Test Runs) |
| Behavioral proof of mig 190 (node+pg, rolled-back tx on dev/Vultr, 4 personas) | **8/8 PASS**: junior-assigned CAN add; associated advisor CAN add + insert income; view-only secretary BLOCKED from add (42501) + income (RLS); no orphan borrowers / atomic; schema registers 190 |

## 6. Deferred (cheap Lows — next commit, per plan)
i18n hardcoded strings (ui-2/ui-3), save-failure toasts on compact fields (ui-5),
citizenship toggle re-sync (ui-4), LIKE-escape (actions-1), returning-lookup race
(domain-1), dead income dialog cluster delete (incomes-1/2/3), delete-income log
consistency (incomes-4), borrower-card file-split (ui-1), missing tests (domain-4),
select-chevron RTL (ui-6). These are quality/cosmetic; the authz layer was the
priority and is closed.

## 7. Contract C-008 ("Borrower identity & income rules persist correctly")
Identity matching sound. The two **authority** gaps (junior-can't-add; ungated
routes) are now closed at the canonical DB layer + the UI. Mark **C-008
partially verified** — deferred quality Lows remain; R15-16 verify simulator
consumption; R17-19 verify final DB controls.

## 8. Instructions for the Next Round / Notes
- Round 9 (obligations, case banks, expenses): obligations write policies were
  proactively canonicalized here (mig 190) — R9 should verify + cover the rest.
- **Migration 190 must be applied to BOTH DBs (Kaufman prod + Vultr, both at 189)
  before/with the code deploy** (apply-before-push, zero-downtime).
- Parallel-agent note: main moved heavily (simulators/statistics/payouts);
  next migration number was 190 (prod schema already at 189).
