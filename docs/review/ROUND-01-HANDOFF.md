# Round 01 Handoff - Platform Runtime, Authentication, and Security Foundations

> Written by the documentation coordinator with explicit user authorization
> (2026-06-12). Review performed 2026-06-11; all findings were subsequently
> FIXED, DEPLOYED TO PRODUCTION, and VERIFIED in the same session — statuses
> below are final, not proposals.

## 1. Scope Promised

- `src/lib/**`, `src/features/auth/**`, `src/proxy.ts`, instrumentation files,
  root app layouts/errors/pages and authentication routes
  (per `docs/REVIEW_PLAN_20_ROUNDS.md` Round 1).

## 2. Scope Actually Reviewed

- All 70 reviewable files reviewed in full (72 assigned minus 2 binary PNG icons).
- Read as dependencies (not owned): `supabase/config.toml`; migrations 048, 059,
  099, 106, 122, 142, 146, 147, 151, 152; `next.config.ts`;
  `sentry.server/edge.config.ts`; Next.js 16 proxy docs; `@supabase/ssr`,
  `@sentry/node-core`, `resend` sources in node_modules.
- NOT reviewed: production Supabase Auth dashboard values (no API access; the
  user configured them manually on 2026-06-12 — see R1-auth-2).

## 3. Files Reviewed

- The exact 72-file list equals the Round-1 bucket computed by
  `scripts/check-review-coverage.mjs` (run twice: pre- and post-round; both
  passed with 1,030 files, zero unassigned).

## 4. Routes and User Flows Reviewed

| Route or flow | Roles tested | Variants tested | Result | Evidence |
| --- | --- | --- | --- | --- |
| Login (+rate limits, `next` redirect) | anon | static adversarial + unit tests | R1-auth-4/5 → Fixed | login.ts + login.test.ts (7 cases) |
| Password reset end-to-end | anon | real vs nonexistent account | R1-auth-1 → Fixed (after() + 600ms floor) | request-password-reset.ts, min-duration.test.ts |
| Invite/recovery links (PKCE + token_hash) | anon→session | open-redirect attempts | Safe (APP_URL-anchored); types narrowed | callback/confirm routes |
| Set-password (post-invite + change) | authenticated | stolen-session scenario | R1-auth-2 → Fixed (revoke others + prod dashboard config) | set-password.ts |
| Middleware session refresh + SEC-AUTH-1 | authed/anon/deactivated | expired-token-at-redirect | R1-edge-1 → Fixed (cookie-carrying redirects) | middleware.ts |
| Secrets encrypt/decrypt (v1/v2/strict) | server | tamper/plaintext/missing-salt | Pass | secrets.ts + tests |
| Sentry PII egress (errors + tracing) | all runtimes | request body, frame vars, spans, JSON-strings | R1-obs-1/2/3 → Fixed | pii-scrub.ts + 12 test cases |
| Rate-limit RPC surface | anon vs service_role | direct PostgREST calls (dev + prod) | R1-extra-1 → Fixed (mig 164 lockdown) | REST probes: anon 401/42501, service 200/204 |

## 5. External Contracts Touched

| Contract or resource | Type | Owner round | Expected behavior | Evidence | Status |
| --- | --- | ---: | --- | --- | --- |
| consume_rate_limit + refund_rate_limit | RPC (migs 048+164) | 19 | service_role-ONLY (anon was a lockout-DoS hole) | prod REST: anon 401/42501 | Confirmed live |
| consume_public_contact_rate_limit | RPC (mig 165) | 19 | the ONLY anon-callable rate-limit door; namespaced + hard-coded caps | mig 165 read | Open (R19 verifies) |
| current_user_active / revoke_user_sessions | RPC (mig 122) | 19 | definer, fail-closed, admin-gated revoke | mig 122 read | Open (C-022) |
| has_permission(s) / is_admin / can_edit_case | RPC | 17-19 | match app helpers (drift was found+fixed: R1-authz-1) | migs 002/091/106/147 | Open (C-001) |
| Supabase Auth | external | 20 | single-use tokens; dashboard policy configured 2026-06-12 | user action | Partially confirmed |
| Resend | external email | 12 | JSON transport (no header injection — verified in SDK source) | resend dist | Confirmed |
| Sentry | external telemetry | 20 | beforeSend + beforeSendTransaction + beforeSendSpan scrub all paths; Node never collects bodies | pii-scrub.test.ts | Confirmed at unit level |
| NEXT_LOCALE cookie / profiles.language | cookie+table | 19 | self-UPDATE RLS allowed | switch-locale.ts | Open (C-024) |

## 6. Findings

All findings were fixed and deployed (prod tip at close: `bca3732`; Round-1 fixes
in `aefa502..03f0a7d`, 21 commits). Severity/status legend per the plan.

| ID | Severity | Status | Owner | Verify | Summary |
| --- | --- | --- | ---: | ---: | --- |
| R1-edge-1 | Medium | Fixed | 1 | 20 | Middleware dropped refreshed session cookies on 2 of 3 redirect branches → `redirectCarryingCookies` helper on all |
| R1-authz-1 | Medium | Fixed | 1 | 19 | userCanEditCase omitted associated advisors; now delegates to can_edit_case RPC (mig 147) |
| R1-auth-1 | Medium | Fixed | 1 | 20 | Password-reset timing oracle → send via after() + every account-dependent exit padded to 600ms floor. Dynamic prod measurement deferred by user |
| R1-auth-2 | Medium | Fixed | 1 | 20 | No re-auth/session-revocation on password change → signOut(scope:'others') after change + user enabled secure_password_change in prod dashboard (2026-06-12). Residual: stolen access JWT vs raw REST API ≤ jwt_expiry |
| R1-obs-1 | Medium | Fixed | 1 | 20 | Sentry shipped request bodies → include.data:false on Node + beforeSendTransaction/beforeSendSpan scrub + JSON-string secret rule |
| R1-obs-2 | Medium | Fixed | 1 | 20 | Sentry shipped stack-frame local vars → frames[].vars scrubbed |
| R1-valid-1 | Medium | Fixed | 1 | 20 | Zero test coverage for IL-ID checksum / phone / sanitize-html → full suites added (repo now 317 tests) |
| R1-edge-2 | Low | Fixed | 1 | 20 | Server Functions on matcher-excluded paths skip SEC-AUTH-1 → warning comment at the matcher; per-action auth remains the rule |
| R1-authz-2 | Low | Fixed | 1 | — | revokeUserSessions returned raw error.message → logs internally, returns {ok} |
| R1-auth-3 | Low | Fixed | 1 | 20 | Weak password policy → schema requires letter+digit (error `weak_password`, bilingual i18n); prod dashboard policy aligned by user |
| R1-auth-4 | Low | Fixed | 1 | 20 | Lockout counted successes + later TOCTOU race → atomic consume-pre-auth + refund_rate_limit on success/infra-error (mig 164). Accepted residual: ~20 distributed failures/window can still deny an account (CAPTCHA out of scope) |
| R1-auth-5 | Low | Fixed | 1 | — | Login error classified by message substring → error.code with message fallback |
| R1-auth-route-1 | Low | Fixed | 1 | — | /auth/confirm accepted 6 OTP types, 3 ever minted → narrowed to invite/recovery/magiclink |
| R1-auth-route-2 | Low | Fixed | 1 | 20 | No explicit no-store on Set-Cookie-bearing auth redirects → redirectNoStore on both routes (used as the live-build fingerprint during deploy verification) |
| R1-secrets-1 | Low | Fixed | 1 | — | INTEGRATION/BACKUP keys+salts not enforced distinct → server-side assertion throws at build |
| R1-secrets-2 | Low | Fixed | 1 | — | Server-actions key floor too low → validated as base64→16/24/32-byte AES key. CAUGHT A REAL BAD PROD KEY at deploy; key rotated on Vercel |
| R1-obs-3 | Low | Fixed | 1 | — | Non-string query_string bypassed scrub → scrubDeep on structured shapes |
| R1-obs-4 | Low | Fixed | 1 | — | logger had no redaction → whole-fields scrubDeep (top-level secret keys dropped) + tests |
| R1-email-1 | Low | Fixed | 1 | — | bodyHtml raw-trust contract → PRE-ESCAPED-ONLY contract documented at the type |
| R1-email-2 | Low | Fixed | 1 | — | No CTA URL scheme allowlist → https/http/mailto/tel only, unsafe CTA dropped+logged |
| R1-email-3 | Low | Fixed | 1 | — | Control chars survived into email subjects → sanitizeSingleLine/sanitizeMultiLine; header injection impossible anyway (Resend JSON transport, verified) |
| R1-valid-2 | Low | Fixed | 1 | — | Optional string validators skipped bidi/control normalization → uniform preprocessors |
| R1-valid-3 | Low | Fixed | 1 | — | isValidIsraeliId accepted all-zeros → rejected; NO min length (real low IDs like '18' pad validly — a first-fix floor regression was caught by the user and reverted) |
| R1-valid-4 | Low | Fixed | 1 | — | Phone validator accepted any 0-prefixed 9/10 digits → real IL prefix ranges; pseudo-Israeli shapes no longer pass as "foreign" (US Dallas 972-locals still do) |
| R1-util-1 | Low | Fixed | 1 | — | formatCurrency('') rendered ₪0 → '—' |
| R1-util-2 | Low | Fixed | 1 | — | cn() missing explicit return type → `: string` |
| R1-shell-1 | Low | Fix Proposed | 1 | 20 | Inline polyfill cements CSP 'unsafe-inline' → tracked TODO in layout.tsx; nonce-per-request CSP is Round-20 work |
| R1-extra-1 | High | Fixed | 1 | 19 | Found DURING fixing: consume_rate_limit executable with the public anon key → direct-PostgREST lockout DoS with zero password attempts. Mig 164 locks consume+refund to service_role; wrappers use the admin client. Verified on dev AND prod (anon 401/42501) |

## 7. Proposed Fixes and Regression Tests

All fixes are implemented and merged; regression tests live in the repo:
`login.test.ts`, `rate-limit.test.ts`, `pii-scrub.test.ts`, `logger.test.ts`,
`min-duration.test.ts`, `israeli-id.test.ts`, `il-phone.test.ts`,
`sanitize-text.test.ts` (extended), `sanitize-html.test.ts` (extended).
Full per-finding fix/regression detail is in the 2026-06-11 session responses.

## 8. Read-Only Commands Run and Commands Requiring Approval

| Command | Run or proposed | Result |
| --- | --- | --- |
| node scripts/check-review-coverage.mjs | Run (pre+post) | 1,030 files, zero unassigned |
| vitest / tsc / eslint / next build | Run (after fixes, with approval) | 317 tests pass; all clean |
| Migration 164 apply (dev) | Run (node+pg, user-approved) | schema_version 164 |
| Migration 164 apply (prod) | Run BY USER (manual) | health gate 503→200 |
| Migration 165 apply (dev) | Run | schema_version 165 |
| REST lockdown probes (dev+prod) | Run | anon 401/42501; service 200/204 |
| Vercel key rotation + redeploy | Run (user-approved "do everything") | prod deploy Ready |
| Dynamic reset-timing measurement | Proposed — deferred by user ("not urgent") | floor+unit tests are standing evidence |

## 9. Contracts Proposed as Confirmed

- Resend JSON transport prevents email header injection.
- Open-redirect protection on `next` across login/callback/confirm (APP_URL-anchored).
- Rate-limit RPC lockdown live in production (anon denied on consume/refund).

## 10. Contracts Requiring Later Verification

| Contract ID | Owning round | Required verification | Why open |
| --- | ---: | --- | --- |
| C-001 | 19 | can_edit_case/RLS still match app helpers post-fix | drift happened once |
| C-020 | 17/19 | consume+refund stay service_role-ONLY; no later migration re-grants anon/authenticated; mig 165's namespaced door stays the only anon path | inverted by 164 — old assumption was anon-callable |
| C-021 | 20 | prod auth dashboard values (user-configured 2026-06-12, not externally verifiable) | no API evidence |
| C-022 | 19 | mig 122 RPC grants + definer + admin gate | app trusts them |
| C-023 | 7,10-13,20 | every /api/* self-authenticates (middleware excludes /api) | by design |
| C-024 | 19 | profiles self-UPDATE RLS for language | silent mirror failure otherwise |
| C-025 | 5-16 | no Zod .passthrough() on formDataToObject consumers | prototype-pollution guard |

## 11. Residual Risks and Blocked Work

- Stolen access JWT works against the raw REST API until expiry (≤ jwt_expiry) even
  after password change — bounded by dashboard config; revisit if jwt_expiry stays 1h.
- Distributed login attack can still deny one account ~20 failures/15min (accepted; CAPTCHA out of scope).
- Anon can burn a victim-IP's public-contact budget (mig 165, documented accepted tradeoff — landing page offers phone/WhatsApp besides the form).
- Reset-timing floor (600ms) unmeasured against live prod latency tails (user deferred).
- CSP still allows 'unsafe-inline' scripts → Round 20.

## 12. Instructions for the Next Round (Round 2)

- Read MASTER_LEDGER.md + this handoff first; run check-review-coverage (must stay 1,030/0 — note: landing/** files were brought under version control after the baseline; re-run and record the new totals).
- Round 2 scope: src/components/**, src/features/pwa/**, src/i18n/**, messages/**, public/**, src/app/globals.css, protected app-shell layouts/global states, docs/mockups/**.
- Inherit from Round 1: (a) `parseLocale`/`direction.ts` is the locale trust boundary — verify all shell consumers use it; (b) R1-shell-1 CSP context when reviewing inline scripts/styles; (c) error boundaries report to Sentry — confirm no error.message rendering in shell states; (d) the new i18n keys from R1 fixes (auth.setPassword.errors.weakPassword, rate_limited, deactivated reason) must exist and read correctly in BOTH catalogs; (e) checklist preset i18n (documents.checklist.*) shipped 2026-06-12 — in scope for catalog review.
