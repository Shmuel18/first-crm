# Round 04 Handoff - Leads, Public Intake, Landing, Consent, Legal

> READ-ONLY REVIEW OUTPUT, now persisted with user approval (2026-06-14).
> Review performed 2026-06-13; approved fixes implemented + deployed 2026-06-14.

## 1. Scope Promised

From `docs/REVIEW_PLAN_20_ROUNDS.md`, Round 4:

- `src/features/leads/**`
- `src/features/intake/**`
- Public intake route
- `landing/**`
- `docs/legal/**`

Focus: landing→intake→lead data flow; spam/replay/validation/consent/privacy/legal
consistency; lead lifecycle, conversion readiness, deletion, notification handoff;
public-endpoint abuse, failure states, mobile, RTL, accessibility.

## 2. Scope Actually Reviewed

- Full primary scope reviewed statically. No source files skipped.
- Dynamic browser/AT verification of the landing site and `/check` wizard was
  **not** performed in this round (static review only) — carried to later rounds.
- Conversion *into cases* is Round 5's domain; only conversion *readiness* and the
  consent/provenance handoff were assessed here.

## 3. Files Reviewed

- All files under the primary scope globs above (leads, intake, landing, legal).
- `node scripts/check-review-coverage.mjs` passes (zero unassigned files).

## 4. Routes and User Flows Reviewed

| Route or flow | Roles tested | Variants tested | Result | Evidence |
| --- | --- | --- | --- | --- |
| Landing `landing/index.html` contact form → `/api/web-lead` | anon | he/en, desktop/mobile (static) | Findings R4-public-api-1/2, R4-legal-2, R4-landing-2/3/4, R4-xcut-1/3 | static read + commits 2c82149, a5799f1, dff8f24 |
| `/check` public intake wizard → `submit_public_intake` RPC → lead | anon | he/en (static) | Consent genuinely captured (z.literal(true), mig 154); purpose/source markers hardened (mig 175) | static read + commit a5799f1 |
| Lead lifecycle (create / assign / convert-readiness) | manager, advisor | — (static) | R4-leads-1 (owner-scope), R4-leads-2, R4-xcut-2/4 | static read + commit 3e2b75d |
| Legal/consent docs (`docs/legal/**`, landing privacy/a11y) | n/a | — | R4-legal-1..6, R4-xcut-3 factual fixes | commit dff8f24 |

## 5. External Contracts Touched

| Contract or resource | Type | Owner round | Expected behavior | Evidence | Status |
| --- | --- | ---: | --- | --- | --- |
| `submit_public_intake` RPC | RPC (anon) | 4 | Anon-callable; records source + consent basis honestly; 3-arg call resolves to new 4-arg | mig 175; real PostgREST probe (3-arg→4-arg) | Verified for fixed paths |
| `leads` table INSERT (`leads_insert` policy) | RLS | 4 | Non-manager may insert only owner-scoped leads; created_by/updated_by un-forgeable | mig 174 | Verified (behavioral, dev) |
| `office_settings.retention_purge_enabled` | flag + guards | 4 | Master switch; default FALSE = ALL destructive purges paused (cron + pg_cron + app eraser) | mig 173 | Verified; consumed by Round 5 (mig 177) |
| `/api/web-lead` | API route | 4 | Public lead intake; rate-limited; confirmation email capped | mig 165 + commit 2c82149 (global hourly ceiling) | Hardened; residual XFF-spoof noted |
| Resend (email sub-processor) | external | 4/12 | Carries intake confirmations + office summaries (PII), not just invites/resets | docs corrected (dff8f24) | Documented; R12 verifies delivery |

## 6. Findings

Tally: **0 High (2 claimed-High refuted), 5 Medium, 15 Low** (20 active).
Statuses below reflect post-fix state (deployed 2026-06-14).

| ID | Severity | Status | Owner | Verif. | Summary |
| --- | --- | --- | ---: | ---: | --- |
| R4-public-api-1 | Medium | Fixed | 4 | 12,19 | `/api/web-lead` emails caller-supplied address; XFF-spoofable IP cap enables inbox-bombing from the verified domain |
| R4-legal-2 | Medium | Fixed | 4 | 19 | Landing form stored server-synthesized `consent:true` though there was no explicit checkbox, only a submit-time notice |
| R4-legal-3 | Medium | Fixed | 4 | 12 | `SUB_PROCESSORS.md` claimed Resend = invites/resets only; it actually carries intake confirmations + office summaries (PII) |
| R4-legal-4 | Medium | Fixed | 4 | 20 | `INCIDENT_RESPONSE.md` breach rollback pointed at the dead Vultr/Docker path, not the Vercel promote-previous reality |
| R4-legal-5 | Medium | Fixed | 4 | 5,10 | 14-day soft-delete purge cron hard-deleted PII an Israeli mortgage office must retain for years |
| R4-intake-2 | Low | Fixed | 4 | 19 | Intake purpose stored as a locale label, so a language switch dropped/garbled it |
| R4-intake-3 | Low | Deferred | 4 | 19 | Honeypot/timing rejections consume no rate-limit budget → denial-of-wallet nuisance |
| R4-landing-2 | Low | Fixed | 4 | — | Stale "mailto/Formspree" header comment vs the real web-lead POST |
| R4-landing-3 | Low | Deferred | 4 | 20 | Landing CSP uses `script-src 'unsafe-inline'`, no nonce/hash (defense-in-depth only) |
| R4-landing-4 | Low | Deferred | 4 | 20 | Landing a11y panel `role=dialog` lacks `aria-modal`/focus-trap/Escape |
| R4-leads-1 | Low | Fixed | 4 | 19 | Non-manager could assign a new lead to any advisor — `leads_insert` was never owner-scoped (integrity, not confidentiality) |
| R4-leads-2 | Low | Deferred | 4 | 19 | Convert failure shows a generic toast, masking unauthorized/not_found |
| R4-legal-1 | Low | Fixed | 4 | — | `SUB_PROCESSORS.md` named Vultr, not Vercel (draft) |
| R4-legal-6 | Low | Deferred | 4 | 19 | `privacy.html` consent scoped only to "documents I upload" |
| R4-public-api-2 | Low | Deferred | 4 | 19 | Honeypot/timing bypassable by omitting fields — compounds public-api-1 |
| R4-xcut-1 | Low | Fixed | 4 | 5 | Landing leads never got a `contact` source badge — producer never wrote the `form_type` key the consumer reads (dead branch) |
| R4-xcut-2 | Low | Deferred | 4 | 5 | Consent record not propagated to the case on conversion; provenance survives only via the retained lead |
| R4-xcut-3 | Low | Fixed | 4 | — | `privacy.html` stale "RECORDED CONSENT not wired" note vs mig 154 |
| R4-xcut-4 | Low | Deferred | 4 | — | `createLeadAction` returned `unknown` on insert failure with no `console.error`, unlike sibling actions |
| R4-xcut-5 | Low | Note-only | 4 | — | Critic re-wording of R4-legal-2 framing (implied-consent-by-notice); folded into the a5799f1 fix |
| R4-intake-1 | — | Refuted | 4 | — | False premise: PG `length()` counts characters, so the 50k Zod cap is under the 65,536 RPC guard — not a bug |
| R4-landing-1 | (claimed High) | Refuted→go-live check | 4 | 20 | CORS-locked-to-apex only breaks the form if served from `www`; no `www` reference exists — recast as a go-live deploy check |

## 7. Proposed Fixes and Regression Tests — as shipped

| Finding ID | Fix (shipped) | Affected files | Migration | Commit |
| --- | --- | --- | --- | --- |
| R4-legal-5 | Master `retention_purge_enabled` switch pausing ALL destructive purges (cron + pg_cron + app eraser) | `office_settings`, retention cron/eraser | **173** | 8026527 |
| R4-leads-1 | Owner-scope `leads_insert` + anti-forgery on created_by/updated_by | leads RLS | **174** | 3e2b75d |
| R4-legal-2 / R4-intake-2 / R4-xcut-1 | Honest consent basis per source (`web_contact`→privacy_notice, not consent.agreed); stable purpose/source markers (not locale labels) | intake metadata, lead source mapping | **175** | a5799f1 |
| R4-public-api-1 | Global hourly ceiling on prospect confirmation emails | `/api/web-lead` | — (code) | 2c82149 |
| R4-legal-1/3/4, R4-landing-2, R4-xcut-3 | Factual legal/docs fixes: both deployment targets described (Vercel production + Vultr staging); sub-processor scope; incident-response runbook; stale landing comments | `docs/legal/**`, `landing/{privacy,index}.html` | — (docs) | dff8f24 |

No automated regression test was added for Round 4 (fixes were RLS/RPC/docs;
behavioral DB checks were run — see §8). DB-behavior re-verification is owned by
Round 19; delivery re-verification by Round 12.

## 8. Read-Only Commands Run and Commands Requiring Approval

| Command | Run or proposed | Result |
| --- | --- | --- |
| `node scripts/check-review-coverage.mjs` | Run | Pass, zero unassigned |
| migs 173-175 apply (dev via node+pg; prod by lead) | Run (approved) | schema → 175 both envs |
| Real PostgREST probe: 3-arg `submit_public_intake` resolves to new 4-arg | Run | Pass |
| `vitest` / `tsc --noEmit` / `eslint` / `next build` (post-fix) | Run (approved) | Pass |

## 9. Contracts Proposed as Confirmed

- None marked fully confirmed. C-004 advanced to **partially verified**.

## 10. Contracts Requiring Later Verification

| Contract ID | Owning round | Required verification | Why it remains open |
| --- | ---: | --- | --- |
| C-004 | 4 | Round 5 verifies conversion imports consent/provenance into the case; R19 verifies final intake DB controls | Consent is captured + DB-enforced for `/check`, but is **not propagated to the case on conversion** (R4-xcut-2) — survives only via the retained lead |

## 11. Residual Risks and Blocked Work

- **R4-public-api-1 residual:** fix is a global hourly ceiling only. The deeper
  option (suppress prospect confirmation for `web_contact`) was raised but not
  taken; XFF-spoof / per-victim nuisance remains for R12/R19 to re-assess. (Low)
- **Deferred Lows** (left for later rounds / go-live): R4-intake-3, R4-landing-3
  (CSP unsafe-inline accepted as defense-in-depth), R4-landing-4, R4-leads-2,
  R4-legal-6, R4-public-api-2, R4-xcut-2, R4-xcut-4.
- **R4-landing-1 (go-live check):** verify the landing site is served from the
  apex domain (not `www`) at cutover, or the CORS lock breaks the form. (Deploy)

## 12. Instructions for the Next Round

- Round 5 (case lifecycle) must verify that **lead→case conversion** does not
  orphan or drop data, and should pick up R4-xcut-2 (consent/provenance not
  imported into the case). Round 5 indeed found and fixed the orphan-on-convert
  path (R5-create-draft-1 / R5-xcut-1, mig 176) and consumed R4-legal-5's
  retention switch (R5-lifecycle-1, mig 177).
- Round 19 re-verifies final public-intake DB controls (migs 154, 165, 173-175).
- Round 12 re-verifies Resend delivery scope (R4-legal-3).
