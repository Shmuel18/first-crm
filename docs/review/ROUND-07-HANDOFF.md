# Round 07 Handoff - Case PDFs, Reports, and Exports

> READ-ONLY REVIEW OUTPUT, persisted with user approval (2026-06-14).
> Review performed 2026-06-14 (multi-agent workflow); approved fixes
> implemented, tested, committed (`1ea7791`), and deployed the same day.

## 1. Scope Promised

From `docs/REVIEW_PLAN_20_ROUNDS.md`, Round 7:

- `src/features/cases/pdf/**` (bank-submission PDF)
- `src/features/cases/services/export/**` (dashboard XLSX/PDF export)
- `src/app/api/exports/**` (export route)

Focus: exports match authorized source data; rate limiting; error contracts;
formula injection; PDF rendering correctness; RTL/i18n; large-dataset behavior.

## 2. Scope Actually Reviewed

- All **14 files** in scope (10 PDF files under `pdf/`, 3 export services, the
  export route). The single-case bank-PDF **action** (`actions/generate-bank-pdf.tsx`,
  technically Round-5 scope) was also reviewed as the PDF entry point.
- Method: 3 dimension reviewers (export-pipeline · pdf-render · formatters/
  cross-cutting) → adversarial refute pass per finding. **14 raw → 8 confirmed
  / 6 refuted** (17 agents). Static review; no dynamic PDF render diffed.
- `node scripts/check-review-coverage.mjs` passes (zero unassigned).

## 3. Files Reviewed

- `src/app/api/exports/cases/route.ts`; `services/export/{build-export-rows,
  xlsx-generator,pdf-generator}`; `pdf/{bank-pdf-document,bank-pdf-data.service,
  cover-page,summary-page,property-page,shared,styles,strings,formatters,fonts}`;
  + `actions/generate-bank-pdf.tsx`.

## 4. External Contracts Touched

| Contract / resource | Type | Owner | Expected | Status |
| --- | --- | ---: | --- | --- |
| `/api/exports/cases` | route | 7 | Auth + permission + rate-limit (5/hr PDF, 10/hr XLSX, fail-closed) + RLS-scoped data; JSON error contract | Verified; try/catch added (1ea7791) |
| `generate-bank-pdf` action | server action | 7 | Auth + Zod id + rate-limit before expensive render; RLS gates the case read | Hardened (1ea7791) |
| `export_bank_pdf` rate-limit key | rate-limit | 7 | New key, 30/hr per user, fail-closed | Added |

## 5. Findings

Tally (post-verification): **0 High, 1 Medium, 6 Low** (7 distinct — two reviewers
reported the rate-limit gap; merged). "Fixed" = shipped in `1ea7791`.

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| R7-pdf-render-1 (= R7-format-crosscut-1) | Medium | **Fixed** | `generateBankPdfAction` ran the expensive `@react-pdf renderToBuffer` with NO `checkRateLimit` — CLAUDE.md requires it for export-pdf, and the sibling `generate-report-pdf.tsx` already does it. Authenticated cost/availability gap (not a data leak — RLS gates the data). |
| R7-pdf-render-2 | Low | **Fixed** | Same action took a raw `caseId` (no Zod uuid) + no explicit `auth.getUser()`; relied solely on RLS. Fixed together with the rate-limit. |
| R7-export-pipeline-2 | Low | **Fixed** | `/api/exports/cases` had no try/catch → a `listCases`/render throw escaped the route's `{ok:false,error}` JSON contract as a raw Next 500. Now wrapped → `errorJson('unknown', 500)`. |
| R7-format-crosscut-2 | Low | **Fixed** | PDF `fmtCurrency`/`fmtNum` guarded only null/undefined → `'NaN ₪'` possible (canonical util uses `Number.isFinite`). Reachability ≈ nil (numeric DB columns can't store NaN); one-line defensive guard added. |
| R7-pdf-render-3 | Low | Deferred | Cover-page borrower table renders one `flex:1` column per borrower with no cap → many borrowers cram/wrap on A4. Uncommon (1–2 borrowers typical); wraps, no data loss. |
| R7-pdf-render-4 | Low | Deferred | `fmtDate` uses bare `toLocaleDateString` (no options) → format differs from the cover-page stamp + varies across runtimes. |
| R7-format-crosscut-4 | Low | Deferred | `fonts.ts` registers weight 600 → the Regular `.ttf` (no SemiBold) → `fontWeight:600` renders at regular weight; react-pdf does no faux-bold. Needs a `heebo-semibold.ttf` asset (documented in a code comment). |

### Refuted (6) — correctly rejected by the verify pass
| ID | Claim | Why refuted |
| --- | --- | --- |
| R7-export-pipeline-1 | Soft-deleted borrowers leak into exports (name + national ID) | RLS `borrowers_select USING (deleted_at IS NULL)` redacts the embed → null → already filtered; export uses the user client, not service-role. **NotABug** |
| R7-export-pipeline-3 | Audit-writer logs `error.message` — use structured logging | Server-side only; narrowing to `.message` is the *intended* PII-safe direction (logger.ts guidance); the suggested "log full err" was counterproductive. **NotABug** |
| R7-export-pipeline-4 | In-memory export + 30s cap = scaling failure | Intentional + documented design; at ~80-case scale there's huge headroom; auth + rate-limited. Informational, not a defect |
| R7-pdf-render-5 | `✓` glyph in RTL Hebrew numeric cell renders ambiguously | react-pdf flex layout (`row-reverse` reorders cells, not intra-cell text); legend defines `✓` in both locales. Cosmetic. **NotABug** |
| R7-format-crosscut-3 | PDF formatters duplicate/diverge from canonical utils | Intentional: reusing the canonical formatter would inject RTL/bidi control marks that **break** react-pdf; the manual `₪` suffix is deliberately deterministic. Documented. **NotABug** |
| R7-format-crosscut-5 | Mixed He/En text has no bidi isolation | False premise — react-pdf 4.5.1 **does** run the Unicode Bidi Algorithm (`bidi-js` via `@react-pdf/textkit`); the signature line is all-LTR anyway. **NotABug** |

## 6. Proposed Fixes and Regression Tests — as shipped (`1ea7791`)

| Finding(s) | Fix | Files |
| --- | --- | --- |
| R7-pdf-render-1/2 | `getCurrentUser` → `z.uuid()` safeParse → `checkRateLimit({action:'export_bank_pdf', subject:'user:<id>', max:30, windowSeconds:3600, failMode:'closed'})` before the render; new error codes `unauthorized`/`rate_limited` | `src/features/cases/actions/generate-bank-pdf.tsx` |
| R7-export-pipeline-2 | try/catch around load→generate→respond; `console.error` + `errorJson('unknown', 500)` | `src/app/api/exports/cases/route.ts` |
| R7-format-crosscut-2 | `\|\| !Number.isFinite(v)` guard | `src/features/cases/pdf/formatters.ts` |

Verification: **tsc 0, lint 0, vitest 388**. No migration (schema unchanged).
No new automated test (behavioral guards; the rate-limit pattern is exercised by
the existing rate-limit suite). Known minor follow-up: the bank-PDF button shows
the generic translated toast for `rate_limited` (no tailored "too many requests"
string — would need an i18n key in the co-mingled `messages/*.json`).

## 7. Read-Only Commands Run + Authorized Runs

| Command | Result |
| --- | --- |
| Round-7 review workflow (3 reviewers + verify, 17 agents) | 14 → 8 confirmed / 6 refuted |
| `tsc --noEmit` / `eslint` / `vitest run` (post-fix) | Pass; 388 tests |
| commit `1ea7791` (3 files; isolated from parallel simulator/statistics work on main) → push → Vercel deploy | see ledger Authorized Test Runs |

## 8. Contracts Proposed as Confirmed

- None fully confirmed. C-007 advanced (see §9).

## 9. Contracts Requiring Later Verification

| Contract ID | Owning round | Required verification | Why open |
| --- | ---: | --- | --- |
| C-007 | 7 | R8/R9 verify the financial/borrower inputs feeding exports; R19 verifies final RLS on the export read paths | Export auth + RLS + soft-delete redaction + rate-limit verified; bank-PDF action guards now added. Cosmetic PDF-render Lows (borrower-table cap, date format, real SemiBold font) deferred |

## 10. Residual Risks and Blocked Work

- **Deferred Low (cosmetic):** borrower-table column cap (R7-pdf-render-3),
  PDF date-format options (R7-pdf-render-4), real `heebo-semibold.ttf` so
  `fontWeight:600` renders bold (R7-format-crosscut-4 — needs a font asset).
- **Minor:** `rate_limited` surfaces the generic "save failed" toast on the
  bank-PDF button (tailored copy deferred to avoid touching co-mingled i18n).

## 11. Instructions for the Next Round

- Round 8 (borrowers, identity, income) verifies the borrower/income data that
  feeds both the bank PDF and the dashboard export; also owns the deferred
  incomes-block edit gate (D-016) and R6-draft-flow-5.
- Round 19 re-verifies the export read paths' final RLS.

## 12. Parallel-Agent Note

Main advanced heavily during this round (simulator redesign, statistics, payouts
by parallel agents); the Round-7 fix commit staged ONLY its own 3 files. Always
re-check `git status` + `git merge-base` before committing in this shared repo.
