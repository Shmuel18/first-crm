# Production Review Master Ledger - 20 Read-Only Rounds

> CANONICAL RECORD: Reviewing agents read this ledger but must not edit it
> without explicit user approval. Each round returns proposed rows and status
> changes in its response. Only the user or an explicitly authorized coordinator
> persists them.

## Review Status

| Round | Scope | Status | Authorized handoff |
| ---: | --- | --- | --- |
| 1 | Platform runtime, authentication, security foundations | **Complete — 27+1 findings fixed, deployed to prod, verified (2026-06-12)** | ROUND-01-HANDOFF.md |
| 2 | Shared UI, design system, app shell, PWA, i18n | **Static review complete — 19 findings (2 Medium, 17 Low) all fixed + deployed; dynamic UI verification pending (2026-06-12)** | ROUND-02-HANDOFF.md |
| 3 | Administration, team, settings, audit, import | **Complete — 21 review findings (1 High, 6 Medium, 14 Low) + R3-team-4b (deploy-caught guard bug) + R3-team-4c (user-found High: is_protected self-escalation, verified in prod) all fixed + DEPLOYED; migs 168-172 in prod; pgTAP guard test added; prod owner = Kaufman (D-011); /api/health 200, schema 172 (2026-06-13)** | ROUND-03-HANDOFF.md |
| 4 | Leads, public intake, landing, consent, legal | **Complete — 20 findings (5 Medium, 15 Low; 2 claimed-High refuted); 11 fixed + DEPLOYED, 8 deferred, 1 note-only; migs 173-175 in prod; build dff8f24** | ROUND-04-HANDOFF.md |
| 5 | Case lifecycle core, dashboard, lists, services | **Complete — 26 findings (2 High, 5 Medium, 19 Low) + 7-entry xcut layer; 2H+5M+2L fixed + DEPLOYED to both deployment targets (Kaufman/Vercel production + Vultr staging), rest deferred; migs 176-180; build fb76e0b; schema 180; 368 tests; 4 pgTAP + 8 erase unit tests; live functional smoke PASSED on Vultr staging (2026-06-14)** | ROUND-05-HANDOFF.md |
| 6 | Case workspace UI and orchestration | **Complete — 22 findings → 19 confirmed (0 High, 1 Medium, 18 Low) + 3 refuted (multi-agent workflow); 10 fixed + DEPLOYED (build aceb724→bc1cfa5, no migration, schema 180), 8 deferred; 375 tests + edit-gate unit tests (2026-06-14)** | ROUND-06-HANDOFF.md |
| 7 | Case PDFs, reports, and exports | Not started | Pending |
| 8 | Borrowers, identity, and income | Not started | Pending |
| 9 | Obligations, case banks, and expenses | Not started | Pending |
| 10 | Documents, uploads, storage, retention, erasure | Not started | Pending |
| 11 | Drive, integrations, backup, restore | Not started | Pending |
| 12 | Templates, email, notifications, push, SLA | Not started | Pending |
| 13 | Tasks, assignment, threads, attachments, reminders | Not started | Pending |
| 14 | Case collaboration, activity timeline, statistics | Not started | Pending |
| 15 | Simulator calculation engine and persistence contracts | Not started | Pending |
| 16 | Simulator UI, comparison, reports, settings | Not started | Pending |
| 17 | Database migrations 001-055 | Not started | Pending |
| 18 | Database migrations 056-110 | Not started | Pending |
| 19 | Final database state, migrations 111-latest, RLS, SQL tests | Not started | Pending |
| 20 | Release engineering, operations, supply chain, integration | Not started | Pending |

## Coverage Baseline

Baseline command:

```powershell
node scripts/check-review-coverage.mjs
```

Baseline captured on 2026-06-11:

| Round | Files assigned | Raw text lines |
| ---: | ---: | ---: |
| 1 | 72 | 3,931 |
| 2 | 72 | 9,999 |
| 3 | 76 | 6,103 |
| 4 | 56 | 4,809 |
| 5 | 60 | 4,333 |
| 6 | 50 | 6,411 |
| 7 | 14 | 2,026 |
| 8 | 51 | 4,829 |
| 9 | 51 | 4,569 |
| 10 | 43 | 4,448 |
| 11 | 32 | 3,099 |
| 12 | 39 | 3,536 |
| 13 | 43 | 5,166 |
| 14 | 37 | 2,945 |
| 15 | 59 | 2,607 |
| 16 | 58 | 4,142 |
| 17 | 55 | 5,361 |
| 18 | 54 | 5,790 |
| 19 | 61 | 10,471 |
| 20 | 47 | 24,734 |
| **Total** | **1,030** | **119,291** |

Round 20 includes dependency metadata and reference/runbook documents. Round 19
includes generated database types. Their raw line counts overstate the amount
of handwritten implementation code.

## Proposed Findings

Authorized coordinator: persist proposed findings after reviewing evidence.
Never delete closed findings.

| ID | Severity | Status | Confidence | Owner round | Verification round | Summary | Evidence | Files |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| R1-edge-1 | Medium | Fixed | High | 1 | 20 | Middleware dropped refreshed session cookies on redirect branches | @supabase/ssr trace; fixed via redirectCarryingCookies | src/lib/supabase/middleware.ts |
| R1-authz-1 | Medium | Fixed | High | 1 | 19 | userCanEditCase omitted associated advisors (narrower than mig 147) | mig 147 vs permissions.ts; now delegates to can_edit_case RPC | src/lib/auth/permissions.ts |
| R1-auth-1 | Medium | Fixed | High | 1 | 20 | Password-reset timing oracle (awaited send for real accounts) | after() + 600ms floor; min-duration tests | src/features/auth/actions/request-password-reset.ts |
| R1-auth-2 | Medium | Fixed | High | 1 | 20 | No re-auth/session-revocation on password change | signOut(scope:'others') + user set prod dashboard 2026-06-12; residual JWT window documented | src/features/auth/actions/set-password.ts |
| R1-obs-1 | Medium | Fixed | High | 1 | 20 | Sentry shipped request bodies (errors + tracing) | include.data:false + transaction/span scrubbers + JSON-string rule; pii-scrub tests | src/lib/sentry/pii-scrub.ts, sentry configs |
| R1-obs-2 | Medium | Fixed | High | 1 | 20 | Sentry shipped stack-frame local variables | frames[].vars scrubbed; tested | src/lib/sentry/pii-scrub.ts |
| R1-valid-1 | Medium | Fixed | High | 1 | 20 | No tests for IL-ID checksum / phone / sanitize-html | suites added; repo at 317 tests | src/lib/validators/*, src/lib/utils/sanitize-html.test.ts |
| R1-edge-2 | Low | Fixed | Medium | 1 | 20 | Matcher-excluded paths skip SEC-AUTH-1 for Server Functions (latent) | warning comment at matcher | src/proxy.ts |
| R1-authz-2 | Low | Fixed | High | 1 | — | revokeUserSessions surfaced raw error.message | logs internally, returns {ok} | src/lib/auth/session.ts |
| R1-auth-3 | Low | Fixed | High | 1 | 20 | Weak password policy (min-8 only; provider floor 6) | letter+digit refine, weak_password i18n; dashboard aligned | src/features/auth/schemas/set-password.schema.ts |
| R1-auth-4 | Low | Fixed | High | 1 | 20 | Lockout counted successes; then TOCTOU race in peek design | atomic consume + refund_rate_limit (mig 164); residual ~20 distributed failures accepted | src/features/auth/actions/login.ts, supabase/migrations/164 |
| R1-auth-5 | Low | Fixed | High | 1 | — | Login error classified by message substring | error.code first | src/features/auth/actions/login.ts |
| R1-auth-route-1 | Low | Fixed | High | 1 | — | /auth/confirm accepted unused OTP types | narrowed to invite/recovery/magiclink | src/app/auth/confirm/route.ts |
| R1-auth-route-2 | Low | Fixed | Medium | 1 | 20 | No explicit no-store on Set-Cookie auth redirects | redirectNoStore both routes; used as live-build fingerprint | src/app/auth/{callback,confirm}/route.ts |
| R1-secrets-1 | Low | Fixed | High | 1 | — | Encryption keys/salts not enforced distinct | build-time assertion | src/lib/env.ts |
| R1-secrets-2 | Low | Fixed | High | 1 | — | Server-actions key under-validated | base64→16/24/32B AES check; CAUGHT real bad prod key; rotated on Vercel | src/lib/env.ts |
| R1-obs-3 | Low | Fixed | Medium | 1 | — | Structured query_string bypassed scrub | scrubDeep on non-string shapes | src/lib/sentry/pii-scrub.ts |
| R1-obs-4 | Low | Fixed | High | 1 | — | logger had no redaction | whole-fields scrubDeep + tests | src/lib/logger.ts |
| R1-email-1 | Low | Fixed | High | 1 | — | bodyHtml raw-trust contract undocumented | PRE-ESCAPED-ONLY contract at type | src/lib/email/render.ts |
| R1-email-2 | Low | Fixed | Medium | 1 | — | No CTA URL scheme allowlist | https/http/mailto/tel only | src/lib/email/render.ts |
| R1-email-3 | Low | Fixed | Medium | 1 | — | Control chars reached email subjects | sanitizeSingleLine/MultiLine; transport-safe regardless (Resend JSON) | src/lib/validators/sanitize-text.ts |
| R1-valid-2 | Low | Fixed | High | 1 | — | Optional validators skipped bidi/control normalization | uniform preprocessors + tests | src/lib/validators/form-primitives.ts |
| R1-valid-3 | Low | Fixed | Medium | 1 | — | isValidIsraeliId accepted all-zeros | all-zeros rejected; NO min length (first-fix floor regression caught by user, reverted) | src/lib/validators/israeli-id.ts |
| R1-valid-4 | Low | Fixed | Medium | 1 | — | Phone accepted any 0-prefixed 9/10 digits; pseudo-IL passed as foreign | real IL prefixes; IL-claim shapes rejected | src/lib/validators/il-phone.ts |
| R1-util-1 | Low | Fixed | High | 1 | — | formatCurrency('') rendered ₪0 | blank guard → '—' | src/lib/utils/format-currency.ts |
| R1-util-2 | Low | Fixed | Medium | 1 | — | cn() implicit return type | `: string` | src/lib/utils.ts |
| R1-shell-1 | Low | Fix Proposed | Medium | 1 | 20 | Inline polyfill cements CSP 'unsafe-inline' | tracked TODO; nonce CSP = Round 20 | src/app/layout.tsx, next.config.ts |
| R1-extra-1 | High | Fixed | High | 1 | 19 | consume_rate_limit executable with public anon key → direct-RPC lockout DoS | mig 164 service_role lockdown; verified dev+prod (anon 401/42501) | supabase/migrations/164, src/lib/rate-limit.ts |
| R2-notif-1 | Medium | Fixed | High | 12 | 19 | IDOR: push-unsubscribe deleted by endpoint alone on RLS-bypassing admin client (cross-user notification DoS) | service.ts delete had no user_id filter; now owner-scoped + regression test | src/features/notifications/services/push-subscriptions.service.ts, actions/unsubscribe-push.ts |
| R2-pwa-1 | Medium | Fixed | High | 2 | — | Logout left device badge + push subscription bound to prior user (shared-device privacy) | cleanupPwaSession (1500ms-timeout-guarded) clears badge + unsubscribes this device | src/features/pwa/lib/cleanup-pwa-session.ts, components/layout/user-menu.tsx |
| R2-shell-1 | Low | Fixed | High | 2 | — | user-menu role=menu/menuitem without ARIA arrow-key model | demoted to labeled disclosure (Tab-reachable) | src/components/layout/user-menu.tsx |
| R2-form-1 | Low | Fixed | High | 2 | — | date-picker Today/Clear hardcoded he/en ternaries | now common.today/common.clear (both catalogs) | src/components/ui/date-picker-popover.tsx |
| R2-form-2 | Low | Fixed | Medium | 2 | — | FormField label htmlFor ignored child's own id | derive id from child id when present | src/components/shared/form-fields.tsx |
| R2-ui-1 | Low | Fixed | Medium | 2 | — | physical pl/pr padding leaks RTL (select trigger, dropdown inset) | switched to logical pe/ps | src/components/ui/{select,dropdown-menu}.tsx |
| R2-pwa-2 | Low | Fixed | High | 2 | — | notifications hardcoded he/rtl on EN payloads | per-locale lang/dir (dispatch route + sw.js) | public/sw.js, src/app/api/push/dispatch/route.ts |
| R2-pwa-3 | Low | Fixed | High | 2 | — | InstallBanner role=dialog no focus mgmt + 24px dismiss | role=status + 44px dismiss | src/features/pwa/components/install-banner.tsx |
| R2-pwa-4 | Low | Fixed | High | 2 | — | offline.html Hebrew-only | bilingual + lang/dir spans | public/offline.html |
| R2-pwa-5 | Low | Fixed | High | 2 | 20 | offline.html inline onclick breaks under strict CSP | replaced with same-origin link (href="" retries original url) | public/offline.html |
| R2-pwa-6 | Low | Fixed | Medium | 2 | — | SW offline fallback resolves undefined on cache eviction | re-fetch + synthetic 503 guard | public/sw.js |
| R2-pwa-7 | Low | Fixed | High | 2 | — | install components missing explicit return types | annotated | src/features/pwa/components/install-*.tsx |
| R2-assets-1 | Low | Fixed | High | 2 | — | no robots.txt; CRM fully crawlable | src/app/robots.ts (Disallow:/) — verified live | src/app/robots.ts |
| R2-assets-2 | Low | Fixed | High | 2 | — | create-next-app SVG cruft + obsolete banks/.gitkeep | deleted | public/ |
| R2-assets-5 | Low | Fixed | High | 2 | — | dead dark-mode palette in light-only app | removed .dark block; class-based variant kept to neutralize OS dark | src/app/globals.css |
| R2-assets-6 | Low | Fixed | Medium | 2 | — | dead Inter load; EN fonts not wired | dropped Inter; CLAUDE.md brand table aligned to unified Heebo/Frank-Ruhl | src/app/{layout.tsx,globals.css}, CLAUDE.md |
| R2-assets-7 | Low | Fixed | High | 2 | — | reduced-motion gate missed tw-animate-css overlays | global 0.01ms clamp | src/app/globals.css |
| R2-assets-8 | Low | Fixed | Medium | 2 | 20 | overflow:hidden + no @media print truncated Ctrl+P | @media print restores flow (dynamic confirm pending) | src/app/globals.css |
| R2-assets-9 | Low | Fixed | Medium | 2 | 20 | universal outline-ring/50 ~1.5:1 focus on unstyled interactives | global :focus-visible AA-safe fallback (dynamic confirm pending) | src/app/globals.css |
| R3-import-1 | High | Fixed | High | 3 | 8,19 | Bulk import persisted id/phone/email with btrim only — no shape/normalization; broke returning-client + wa.me/tel invariants | ImportRowSchema validate+normalize, all-or-nothing, persists parsed values; vitest | src/features/import/{actions/import-cases.ts,schemas/import-row.schema.ts,domain/validate-rows.ts} |
| R3-import-2 | Medium | Fixed | High | 3 | 19 | RPC accepted any create_case holder + no row cap → direct PostgREST bypassed admin gate + 5/hr limit | mig 168: is_admin() required + jsonb_array_length cap 2000 | supabase/migrations/168 |
| R3-import-3 | Medium | Fixed | High | 3 | 5,8 | Silent fallbacks: unmatched status→case_opened, unknown/inactive advisor→importer | PASS-1 errors unknown_status/unknown_advisor; advisor lookup requires active, non-deleted | supabase/migrations/168, src/features/import/components/import-panel.tsx |
| R3-roles-1 | Medium | Fixed | High | 3 | 19 | role_permissions + user_permission_overrides had NO audit triggers (composite PKs) | mig 169 dedicated audit fn (parser's changed_fields shape) + triggers | supabase/migrations/169 |
| R3-roles-2 | Medium | Fixed | High | 3 | 19 | Admin role permission set enforced only in TS — admin JWT could rewrite admin role_permissions via PostgREST | mig 169 BEFORE trigger rejects authenticated/anon writes to admin-role rows; service_role+SQL open. Chosen over is_admin short-circuit (would disable BLOCK overrides) | supabase/migrations/169 |
| R3-settings-1 | Medium | Fixed | High | 3 | 20 | settings/security change-password missed R1-auth-2 — stolen session survived pw change | signOut(scope:'others') best-effort after update | src/features/settings/actions/change-password.ts |
| R3-team-1 | Medium | Fixed | High | 3 | 19 | resendInvite minted a passwordless magiclink for ANY non-deleted member → impersonation of onboarded advisors | refuses not_allowed when last_sign_in_at set or profile inactive | src/features/team/actions/resend-invite.ts |
| R3-import-4 | Low | Fixed | High | 3 | — | Error rows didn't match file line numbers; `ת״ז` gershayim header unmapped | SourceRow true file-rows (ExcelJS rowNumber + CSV line counting); gershayim-tolerant normalize | src/features/import/domain/parse-table.ts, services/import.service.ts |
| R3-import-5 | Low | Fixed | Medium | 3 | — | CSV decoded UTF-8 only (cp1255 mojibake); .xls accepted but unsupported | windows-1255 fallback on replacement-char sniff; accept=.csv,.xlsx; column/row caps | src/features/import/services/import.service.ts, components/import-panel.tsx |
| R3-import-6 | Low | Fixed | High | 3 | — | import_jobs always 'completed' (even blocked import); completed_at unwritten; failed RPC unlogged | logImportJob takes status completed/failed + sets completed_at | src/features/import/services/import.service.ts |
| R3-import-7 | Low | Mitigated | Medium | 3 | 8 | RPC idempotency keyed solely on national_id → re-run duplicates every ID-less row | best-effort possible_duplicate read-side warning; residual accepted (D-007) | src/features/import/services/import-duplicates.ts |
| R3-roles-3 | Low | Fixed | High | 3 | — | revalidatePath('/settings/roles') retired path — live page didn't refresh | → /settings/people | src/features/settings/actions/toggle-role-permission.ts |
| R3-roles-4 | Low | Fixed | High | 3 | 19 | Hidden-keys filter client-only — admin could plant a dormant grant on a hidden key | server-side refusal of HIDDEN_PERMISSION_KEYS (shared server-free const) | src/features/settings/{actions/toggle-role-permission.ts,permissions.constants.ts} |
| R3-roles-5 | Low | Fixed | Medium | 3 | — | No console.error on upsert failure; getRolesPermissions empty-silent on query fail | each leg logs | src/features/settings/services/permissions.service.ts |
| R3-roles-6 | Low | Note only | Medium | 3 | — | Per-user overrides (FIRST precedence) invisible in editor, no surface — false-completeness risk | static override note added; full surface = Phase 2 (D-009) | src/features/settings/components/roles-permissions-editor.tsx |
| R3-settings-2 | Low | Fixed | High | 3 | 20 | mfa.ts 121 lines/4 actions (over limit); disableMfa without fresh code | split mfa.ts (enroll/verify) + mfa-manage.ts (status/disable); fresh-code = D-008 | src/features/settings/actions/{mfa.ts,mfa-manage.ts} |
| R3-settings-3 | Low | Fixed | Medium | 3 | — | logo_url validated only by max(2048) — no scheme/host check | `^https://` regex (admin-only; next/image host allowlist bounds it) | src/features/settings/schemas/bank.schema.ts |
| R3-settings-4 | Low | Fixed | Medium | 3 | — | generateBankKey/sort_order race (unique→'unknown'); bankInUse missed mig-106 market-data tables | create-bank retries once on 23505; delete-bank maps any FK 23503→in_use | src/features/settings/actions/{create-bank.ts,delete-bank.ts} |
| R3-team-2 | Low | Fixed | High | 3 | 19 | 4 non-transactional writes — partial failure left cases reassigned but member active | mig 170 admin_delete_member: reassign+cleanup+soft-delete in ONE transaction | supabase/migrations/170, src/features/team/actions/delete-member.ts |
| R3-team-3 | Low | Fixed | High | 3 | — | invite-member profile fill-in on admin client → audit user_id=NULL (unattributed) | request-scoped client | src/features/team/actions/invite-member.ts |
| R3-team-4 | Low | Fixed | High | 3 | 19 | No protected-owner concept — second admin could demote/deactivate Kaufman | mig 170 profiles.is_protected + guard_protected_profile (blocks demote/deactivate/soft-delete/unprotect); prod owner marking corrected to Kaufman (D-011) | supabase/migrations/170 |
| R3-team-4b | Low | Fixed | High | 3 | 19 | guard_protected_profile escape hatch broken: `NULL NOT IN ('authenticated','anon')` is NULL not TRUE → direct-SQL recovery (auth.role() IS NULL) was wrongly blocked too (documented ownership-move recovery failed). Found at deploy when the prod owner correction was refused | mig 171 adds explicit `IS NULL`; end-user enforcement + service_role restore unaffected (verified dev+prod) | supabase/migrations/171 |
| R3-team-4c | High | Fixed | High | 3 | 19 | Privilege escalation (user-found, verified in prod, SELF_PROTECT_SUCCEEDED): mig-170 guard only checked transitions when OLD.is_protected was already TRUE, so a regular authenticated user could self-set is_protected FALSE→TRUE on their own profile, then admins could not demote/deactivate/delete them | mig 172: is_protected fully immutable for authenticated/anon (both directions) + INSERT guard + single-owner partial unique index; pgTAP test; 5-case behavioral proof passed dev+prod | supabase/migrations/172, supabase/tests/protected_profile_guard_test.sql |
| R4-public-api-1 | Medium | Fixed | High | 4 | 12,19 | /api/web-lead emails caller-supplied address; XFF-spoofable IP cap enables inbox-bombing from the verified domain | Global hourly ceiling on prospect confirmation emails (code); residual XFF-spoof noted | src/app/api/web-lead, commit 2c82149 |
| R4-legal-2 | Medium | Fixed | High | 4 | 19 | Landing form stored server-synthesized consent:true with no explicit checkbox, only a submit-time notice | mig 175 honest consent basis per source (web_contact→privacy_notice) | landing/index.html, supabase/migrations/175 |
| R4-legal-3 | Medium | Fixed | High | 4 | 12 | SUB_PROCESSORS.md claimed Resend = invites/resets only; actually carries intake confirmations + office summaries (PII) | docs corrected | docs/legal/SUB_PROCESSORS.md, commit dff8f24 |
| R4-legal-4 | Medium | Fixed | High | 4 | 20 | INCIDENT_RESPONSE.md breach rollback pointed at the dead Vultr/Docker path, not Vercel promote-previous | docs corrected (both deployment targets described — Vercel production + Vultr staging) | docs/legal/INCIDENT_RESPONSE.md, commit dff8f24 |
| R4-legal-5 | Medium | Fixed | High | 4 | 5,10 | 14-day soft-delete purge cron hard-deleted PII the office must retain for years | mig 173 master retention_purge_enabled switch (default FALSE=paused), gates ALL destructive paths | supabase/migrations/173 |
| R4-intake-2 | Low | Fixed | High | 4 | 19 | Intake purpose stored as a locale label → language switch dropped/garbled it | mig 175 stable purpose/source markers | supabase/migrations/175 |
| R4-intake-3 | Low | Deferred | Medium | 4 | 19 | Honeypot/timing rejections consume no rate-limit budget → denial-of-wallet nuisance | — | src/features/intake public-api guards |
| R4-landing-2 | Low | Fixed | High | 4 | — | Stale mailto/Formspree header comment vs the real web-lead POST | comment corrected | landing/index.html, commit dff8f24 |
| R4-landing-3 | Low | Deferred | Medium | 4 | 20 | Landing CSP uses script-src 'unsafe-inline', no nonce/hash (defense-in-depth only) | accepted as defense-in-depth | landing CSP config |
| R4-landing-4 | Low | Deferred | Medium | 4 | 20 | Landing a11y panel role=dialog lacks aria-modal/focus-trap/Escape | — | landing/accessibility a11y panel |
| R4-leads-1 | Low | Fixed | High | 4 | 19 | Non-manager could assign a new lead to any advisor — leads_insert never owner-scoped (integrity) | mig 174 owner-scope + anti-forgery created_by/updated_by | supabase/migrations/174 |
| R4-leads-2 | Low | Deferred | Medium | 4 | 19 | Convert failure shows a generic toast, masking unauthorized/not_found | — | leads convert action/UI |
| R4-legal-1 | Low | Fixed | High | 4 | — | SUB_PROCESSORS.md named Vultr, not Vercel (draft) | docs corrected | docs/legal/SUB_PROCESSORS.md, commit dff8f24 |
| R4-legal-6 | Low | Deferred | Medium | 4 | 19 | privacy.html consent scoped only to "documents I upload" | — | landing/privacy.html |
| R4-public-api-2 | Low | Deferred | Medium | 4 | 19 | Honeypot/timing bypassable by omitting fields — compounds public-api-1 | — | src/app/api/web-lead |
| R4-xcut-1 | Low | Fixed | High | 4 | 5 | Landing leads never got a contact source badge — producer never wrote the form_type key the consumer reads (dead branch) | mig 175 source mapping | supabase/migrations/175 |
| R4-xcut-2 | Low | Deferred | High | 4 | 5 | Consent record not propagated to the case on conversion; provenance survives only via the retained lead | keeps C-004 open | lead→case convert path |
| R4-xcut-3 | Low | Fixed | High | 4 | — | privacy.html stale "RECORDED CONSENT not wired" note vs mig 154 | docs corrected | landing/privacy.html, commit dff8f24 |
| R4-xcut-4 | Low | Deferred | Medium | 4 | — | createLeadAction returned unknown on insert failure with no console.error, unlike sibling actions | — | src/features/leads actions |
| R4-xcut-5 | Low | Note only | Medium | 4 | — | Critic re-wording of R4-legal-2 (implied-consent-by-notice); folded into the a5799f1 fix | — | (note on R4-legal-2) |
| R4-intake-1 | — | Refuted | High | 4 | — | False premise: PG length() counts characters, so the 50k Zod cap is under the 65,536 RPC guard — not a bug | dropped | (none) |
| R4-landing-1 | — | Refuted→go-live check | High | 4 | 20 | CORS-locked-to-apex only breaks the form if served from www; no www reference exists — recast as a go-live deploy check | verify apex at cutover | landing CORS / canonical URLs |
| R5-create-draft-1 | High | Fixed | High | 5 | 19 | New draft case created with NULL assigned_advisor_id → invisible+uneditable (404) to a view-own-only creator | mig 176 BEFORE INSERT trigger auto-assigns creator unless view_all_cases; pgTAP | supabase/migrations/176, supabase/tests/case_create_advisor_test.sql |
| R5-lifecycle-1 | High | Fixed | High | 5 | 10,19 | Manual permanent-delete bypassed the retention master switch — hard-deleted case+files while purges paused | mig 177 PT001 guard + recycle-bin UI; pgTAP + action test | supabase/migrations/177, supabase/tests/case_permanent_delete_retention_test.sql |
| R5-create-draft-2 | Medium | Fixed | High | 5 | — | clearDirty() ran before the save transition → a FAILED save lost unsaved borrower data silently | removed pre-save clearDirty() | src/features/cases/components/new-case-page-client.tsx |
| R5-lifecycle-2 | Medium | Fixed | High | 5 | 10 | File erasure didn't log orphaned Storage/Drive pointers on failure; ref collection swallowed read errors | collectCaseFileRefs fail-closed + durable erasure_orphan_log rows (incl. case folder); 8 unit tests | src/features/cases/services/erase-case-files.ts, supabase/migrations/177 |
| R5-update-fee-1 | Medium | Fixed | High | 5 | 19 | change_case_status/assign_case_to_user bypassable via updateCaseFieldAction & updateCaseAction (only quickUpdate enforced) | mig 178 BEFORE UPDATE trigger (only-when-changed) + action gates; pgTAP | supabase/migrations/178, src/features/cases/actions/update-case-field.ts |
| R5-advisors-properties-email-1 | Medium | Fixed | High | 5 | 19 | Associated advisors could open the properties UI but every add/edit/remove silently failed (action gate vs table RLS mismatch) | migs 179-180 route through can_edit_case + created_by anti-forgery + write-once trigger + 0-row check; pgTAP plan 5 | supabase/migrations/179, supabase/migrations/180, src/features/cases/actions/update-case-property-field.ts |
| R5-domain-logic-1 | Medium | Fixed | High | 5 | — | Greeting + target-date used server (UTC) clock not Israel TZ; SSR/filter vs client badge disagreed near midnight | israelCivil() via Intl Asia/Jerusalem; tests | src/features/cases/domain/{greeting,target-date}.ts, src/lib/utils/israel-time.ts |
| R5-create-draft-3 | Low | Deferred | Medium | 5 | — | Duplicate borrower (same national_id) in one draft silently dropped (ON CONFLICT DO NOTHING) | — | supabase/migrations/142 |
| R5-create-draft-4 | Low | Deferred | Medium | 5 | — | 'setup' error leaks a stale internal migration number (says 074; live RPC is 142) | — | messages/en.json, draft setup error path |
| R5-create-draft-5 | Low | Deferred | Medium | 5 | — | saveCaseDraftAction (the only live create path) has no checkRateLimit | — | src/features/cases/actions/save-case-draft.ts |
| R5-create-draft-6 | Low | Deferred | Medium | 5 | — | Dead code: createCaseAction + CaseForm mode==='create' branch unreachable | — | src/features/cases/components/case-form.tsx, actions/create-case.ts |
| R5-update-fee-2 | Low | Deferred | Medium | 5 | — | Edit-case page renders the full edit form (even for non-editors) without an upfront userCanEditCase gate | — | src/app/(app)/cases/[id]/edit/page.tsx |
| R5-update-fee-3 | Low | Deferred | High | 5 | 9 | case_financials fee writes have no optimistic-lock/CAS → concurrent manager edits last-write-wins | — | src/features/cases/actions/update-case-fee-amount.ts |
| R5-update-fee-4 | Low | Deferred | Medium | 5 | — | Inline single-field edits skip the cross-field rule (mortgage ≤ property) the full form enforces | — | src/features/cases/actions/update-case-field.ts |
| R5-update-fee-5 | Low | Deferred | Medium | 5 | — | Inline-edit server actions exceed the 100-line file limit | — | src/features/cases/actions/update-case-field.ts |
| R5-lifecycle-3 | Low | Fixed | High | 5 | — | Recycle-bin "purge in N days" countdown + red warning misleading while the automated purge is paused | show-all + paused banner + disabled action when paused | src/features/cases/services/deleted-cases.service.ts, components/recycle-bin-list.tsx |
| R5-lifecycle-4 | Low | Deferred | Medium | 5 | — | permanentDeleteCaseAction (Storage + Drive external calls) is not rate-limited | — | src/features/cases/actions/permanent-delete-case.ts |
| R5-advisors-properties-email-2 | Low | Deferred | Medium | 5 | — | savePurpose issues two non-atomic property updates; second-call failure leaves a partial write while the client reverts both | — | src/features/cases/components/case-additional-properties.tsx |
| R5-advisors-properties-email-3 | Low | Deferred | Medium | 5 | 13 | addAssociatedAdvisorAction doesn't verify advisorId is an active advisor (only FK to profiles); Suspected, NOT an IDOR (xcut-7) | — | src/features/cases/actions/add-associated-advisor.ts |
| R5-advisors-properties-email-4 | Low | Deferred | Medium | 5 | — | is_responsible error collapses to a generic 'saveFailed' toast | — | src/features/cases/components/associated-advisors-field.tsx |
| R5-advisors-properties-email-5 | Low | Deferred | Medium | 5 | — | Pure domain helper resolveAdvisorName has no unit test | — | src/features/cases/domain/advisor-name.ts |
| R5-domain-logic-2 | Low | Fixed | High | 5 | — | 'soon' (≤7 days) window added fixed 7×DAY_MS across DST → off-by-one on the 7th day twice a year | calendar-day window (new Date(y,m,d+7)); tests | src/features/cases/domain/target-date.ts |
| R5-domain-logic-3 | Low | Deferred | Medium | 5 | — | DTI/LTV/sort tests cover happy paths only (miss negative value, LTV>100, NaN dates, multi-primary borrower) | — | src/features/cases/domain/calculations.test.ts |
| R5-dashboard-list-1 | Low | Deferred | High | 5 | 14 | Manager-only fee (case_financials) shipped to the browser in the dashboard list payload it never displays | — | src/features/cases/services/cases.service.ts |
| R5-dashboard-list-2 | Low | Deferred | Medium | 5 | — | Dashboard list over-fetches and ships unused heavy columns/embeds to client components | — | src/features/cases/services/cases.service.ts |
| R5-dashboard-list-3 | Low | Deferred | Medium | 5 | — | Dead code: getCaseViewCounts superseded by the bootstrap RPC but still exported | — | src/features/cases/services/cases.service.ts |
| R5-xcut-1 | High | Fixed | High | 5 | 19 | (cross-ref of create-draft-1) Lead→case conversion creates an orphaned NULL-advisor case; lead consumed, can't retry | mig 176 trigger covers the convert path | supabase/migrations/176 |
| R5-xcut-2 | Medium | Fixed | High | 5 | 19 | (cross-ref of advisors-properties-email-1) case_properties RLS (mig 156) omits associated advisors but actions gate on userCanEditCase | migs 179-180 | supabase/migrations/179 |
| R5-xcut-3 | Medium | Fixed | High | 5 | 19 | (cross-ref of update-fee-1) status/assign enforced by only 1 of 3 sibling case-update actions | mig 178 | supabase/migrations/178 |
| R5-xcut-4 | High | Fixed | High | 5 | 10,19 | (cross-ref of lifecycle-1) manual permanent-delete + erasure bypasses the retention master switch (mig 173) | mig 177 | supabase/migrations/177 |
| R5-xcut-5 | Low | Deferred | High | 5 | 14 | (cross-ref of dashboard-list-1) manager-only fee over-fetched + serialized to clients that never render it | — | src/features/cases/services/cases.service.ts |
| R5-xcut-6 | Low | Deferred | High | 5 | 12 | NEW: sendClientEmailAction (advisor-initiated client email) has no checkRateLimit unlike other outbound actions | — | src/features/cases/actions/send-client-email.ts |
| R5-xcut-7 | Low | Note only | High | 5 | — | Meta-note: re-classified advisors-properties-email-3 Suspected→Verified (Low), explicitly NOT an IDOR | — | (note on R5-advisors-properties-email-3) |
| R6-inline-actions-1 | Medium | Fixed | High | 6 | 19 | Case-detail page had NO userCanEditCase gate → view-only users (secretary w/ view_all on an unassigned case) saw ALL edit affordances (borrowers/request-details/property/case-details/banks+expenses/status+advisor) that fail at the server. Expanded from status/advisor-only on user review | aceb724: page computes canEditCase + threads read-only gate everywhere; status needs change_case_status, advisor needs assign_case_to_user; dashboard per-row CaseEditGate (NOT canViewAll); unit tests | src/app/(app)/cases/[id]/page.tsx, cases/page.tsx, case-details-section, case-admin-block, case-property-block, editable-* cells, src/features/cases/domain/case-edit-gate.ts(.test.ts) |
| R6-detail-compose-1 | Low | Fixed | High | 6 | — | Dead case-info-rows.tsx (DataRow/BlockerRow/InsuranceRow) + now-dead schema color consts | deleted; consts removed | src/features/cases/components/case-info-rows.tsx (del), case.schema.ts |
| R6-detail-compose-2 | Low | Fixed | High | 6 | — | Dead case-detail-helpers.tsx (bandToAccent/EmptyBorrowers) + stale comment | deleted; comment fixed | src/features/cases/components/case-detail-helpers.tsx (del), add-borrower-button.tsx |
| R6-detail-compose-3 | Low | Fixed | High | 6 | — | [id]/loading.tsx skeleton (6 blocks, 2-col) didn't match the real page (7 full-width) → reflow flash | skeleton now 7 full-width | src/app/(app)/cases/[id]/loading.tsx |
| R6-detail-compose-4 | Low | Refuted | High | 6 | — | CaseBlock captures saved open/closed pref only on mount — claimed stale | NotABug: prefs are page-stable server data; re-sync would yank sections open under the user (intentional) | (none) |
| R6-inline-actions-1-orig | High→Medium | (see R6-inline-actions-1) | — | 6 | — | Original narrow scoping (status/advisor cells only); downgraded High→Medium (server boundary enforced) then expanded | — | — |
| R6-inline-actions-2 | Medium | Refuted | High | 6 | — | Delete confirm in AlertDialogCancel claimed to defeat pending guard | NotABug: Cancel/Action both alias Close; auto-dismiss-on-confirm is the codebase pattern; idempotent soft-delete + isPending guard | (none) |
| R6-inline-actions-3 | Low | Fixed | High | 6 | 12 | generate-bank-pdf returned + toasted raw error.message (un-i18n'd) | log server-side, return generic code, translated toast | src/features/cases/actions/generate-bank-pdf.tsx, generate-bank-pdf-button.tsx |
| R6-inline-actions-4 | Low | Fixed | High | 6 | — | Target-date popover lacked the resize→close listener the status/advisor cells have | added resize listener | src/features/cases/components/editable-target-date-cell.tsx |
| R6-inline-actions-5 | Low | Fixed | High | 6 | — | CaseStatusBadge.interactive prop + ChevronDown branch dead | removed | src/features/cases/components/case-status-badge.tsx |
| R6-inline-actions-6 | Low | Deferred | High | 6 | 2 | Hardcoded Ctrl+Enter/Esc literals in the note hint (not i18n) | deferred — its home messages/*.json was co-mingled w/ parallel email-attachments commit | src/features/cases/components/editable-text-cell.tsx |
| R6-inline-actions-7 | Low | Deferred | High | 6 | 2 | Status label hardcoded name_he (Hebrew labels in EN) | duplicate of tracked DSGN-i18n-status-labels | editable-status-cell.tsx, case-status-badge.tsx |
| R6-dashboard-list-1 | Low | Fixed | High | 6 | — | Welcome-banner date used UTC not Israel TZ (greeting already Israel-anchored) | pinned to Asia/Jerusalem | src/features/cases/components/dashboard-welcome-banner.tsx |
| R6-dashboard-list-2 | Low | Deferred | High | 6 | 14 | Manager-only case_financials over-fetched into the dashboard list payload (manager's own browser, not cross-user leak) | duplicate of deferred R5-dashboard-list-1 | src/features/cases/services/cases.service.ts |
| R6-dashboard-list-3 | Low | Refuted | High | 6 | — | National-id on mobile card lacks <bdi> LTR isolation | unreachable: isValidIdOrPassport rejects all separators, so a neutral-free run can't bidi-reorder | (none) |
| R6-dashboard-list-4 | Low | Fixed | High | 6 | — | Sort-control trigger used ↑/↓ glyphs (= R6-crosscut-1) | Lucide ArrowUp/ArrowDown + worded aria-label | src/features/cases/components/cases-sort-control.tsx |
| R6-draft-flow-1 | Low | Deferred | High | 6 | — | draft-borrower-card.tsx 283 lines (>250) | file-split (defer) | src/features/cases/components/draft-borrower-card.tsx |
| R6-draft-flow-2 | Low | Deferred | High | 6 | — | case-form.tsx 259 lines (>250) | file-split (defer) | src/features/cases/components/case-form.tsx |
| R6-draft-flow-3 | Low | Deferred | High | 6 | — | CaseForm create-mode branch + createCaseAction unreachable | duplicate of deferred R5-create-draft-6 | src/features/cases/components/case-form.tsx |
| R6-draft-flow-4 | Low | Fixed | High | 6 | — | Dead clearDirty action/callback after R5-create-draft-2 fix + stale comment | removed | src/features/cases/hooks/use-case-draft-state.ts |
| R6-draft-flow-5 | Low | Deferred | High | 6 | 8 | Returning-client amber overwrite-flag only on 7 of the fillable fields (4 visible misc/citizenship unflagged) | needs R8 borrower compact-field threading | src/features/cases/components/draft-borrower-card.tsx, borrower-misc-row.tsx |
| R6-draft-flow-6 | Low | Deferred | High | 6 | — | "setup" error shows a developer "run migration 074" message to advisors | duplicate of deferred R5-create-draft-4; practically unreachable | src/features/cases/components/new-case-page-client.tsx, messages/*.json |
| R6-crosscut-1 | Low | Fixed | High | 6 | — | Sort indicator uses Unicode arrow glyphs as visible UI (= R6-dashboard-list-4) | fixed with dashboard-list-4 | src/features/cases/components/cases-sort-control.tsx |

## Cross-Round Contracts

Authorized coordinator: persist proposed contract updates after reviewing
evidence.

| Contract ID | Producer | Consumers/verifiers | Contract | Evidence | Status |
| --- | ---: | --- | --- | --- | --- |
| C-001 | 1 | 17-20 | App authorization helpers match final RLS/RPC grants | R1 found+fixed one drift (R1-authz-1: userCanEditCase now delegates to can_edit_case RPC) | Open — R19 re-verifies |
| C-002 | 2 | 4-16,20 | Shared UI/i18n primitives work correctly in product contexts | Pending | Open |
| C-003 | 3 | 17-20 | Admin, team, audit, and import permissions match database controls | R3 hardened: import is_admin-gated (mig 168), admin-role perms trigger-protected (mig 169), member-delete atomic + protected-owner-aware (mig 170); audit now covers composite-PK permission tables | Partially verified — R19 re-verifies final grants |
| C-004 | 4 | 5,19,20 | Public intake preserves consent and converts safely | R4: consent genuinely captured + DB-enforced for /check (z.literal(true), mig 154); landing web-contact basis made honest per source (mig 175). GAP: consent/provenance NOT propagated to the case on conversion (R4-xcut-2) — survives only via the retained lead | Partially verified — R5 confirmed convert no longer orphans (mig 176); rich consent/metadata import still open (R5 convert rich-path not field-diffed) |
| C-005 | 5 | 6,8-10,14,19,20 | Case lifecycle and visibility rules are consistent | R5 found 4 app↔DB consistency breaks (orphan-on-create/convert, case_properties RLS narrower than can_edit_case, status/assign enforced in only 1 of 3 actions, permanent-delete bypassing the retention switch) — all closed by migs 176-180 + DB triggers on both deployment targets (Kaufman/Vercel production + Vultr staging) | Closed for fixed paths — partially open: deferred Lows (inline cross-field rule, fee lost-update, manager-only over-fetch) + R19 final-grant re-verification |
| C-006 | 6 | 8-14,20 | Case workspace composes child domains without leaks or stale state | R6: composition sound — no cross-case leak (bidi candidate refuted), no stale-state defect (prefs candidate intentional). Closed the edit-affordance gap: case-detail UI now gates every edit surface on can_edit_case + the granular status/assign perms (aceb724), and the dashboard gates per-row (not canViewAll) | Partially verified — incomes/obligations edit gate NOT yet wired (full-width grid, R8/R9); manager-only over-fetch (R6-dashboard-list-2) deferred; R19 re-verifies final state |
| C-007 | 7 | 8-9,20 | Exports match authorized source data | Pending | Open |
| C-008 | 8 | 15,19,20 | Borrower identity and income rules persist correctly | Pending | Open |
| C-009 | 9 | 10,15,19,20 | Financial, bank, expense, and receipt rules remain consistent | Pending | Open |
| C-010 | 10 | 11,19,20 | Storage, Drive, retention, and erasure remain consistent | Pending | Open |
| C-011 | 11 | 19,20 | Backup and restore are complete and operationally recoverable | Pending | Open |
| C-012 | 12 | 13,19,20 | Email/notification/SLA delivery is authorized and idempotent | Pending | Open |
| C-013 | 13 | 10,12,14,19,20 | Tasks/comments/attachments/notifications remain consistent | Pending | Open |
| C-014 | 14 | 19,20 | Activity and statistics match source events and permissions | Pending | Open |
| C-015 | 15 | 16,18-20 | Simulator calculations and persistence contracts are correct | Pending | Open |
| C-016 | 17 | 18-20 | Later migrations preserve or intentionally replace foundations | Pending | Open |
| C-017 | 18 | 19-20 | Final migrations preserve hardening and transactional guarantees | Pending | Open |
| C-018 | 19 | 20 | Final schema/RLS/RPC state matches all application assumptions | Pending | Open |
| C-019 | 1-19 | 20 | Every critical workflow has complete release evidence | Pending | Open |
| C-020 | 1 | 17,19 | consume_rate_limit + refund_rate_limit are service_role-ONLY (mig 164); consume_public_contact_rate_limit (mig 165) is the ONLY anon-callable rate-limit door (namespaced, hard-coded caps); no later migration may re-grant anon/authenticated | Prod REST probes 2026-06-11: anon 401/42501 on both | Open — R19 verifies final grants |
| C-021 | 1 | 20 | Prod Supabase Auth dashboard: secure_password_change + password policy configured (user, 2026-06-12); values not externally verifiable | User action | Open — R20 collects evidence |
| C-022 | 1 | 19 | Mig 122 RPCs (current_user_active / revoke_user_sessions): SECURITY DEFINER, fail-closed, admin-gated revoke | Mig 122 read | Open |
| C-023 | 1 | 7,10-13,20 | Every /api/* route self-authenticates (middleware deliberately excludes /api) | Middleware comment + design | Open |
| C-024 | 1 | 19 | profiles RLS allows self-UPDATE of language (switch-locale after() mirror) | Code trace | Open |
| C-025 | 1 | 5-16 | No Zod schema on a formDataToObject consumer uses .passthrough() (prototype-pollution guard relies on strip) | R1 verified current callers | Open — product rounds re-check |
| C-002 | 2 | 4-16,20 | Shared UI/i18n primitives work in product contexts (he↔en parity 1,947=1,947, ICU clean, TipTap+textToHtml XSS-safe) | R2 static review + machine check | Open — product rounds verify in context |
| C-026 | 2 | 20 | offline.html + layout polyfill are un-nonceable inline surfaces the CSP round must allow-list/refactor (offline onclick already removed) | R2 trace | Open — Round 20 (CSP) |
| C-027 | 2 | 12 | Web Push payloads stay PII-free AND carry per-recipient lang/dir | R2 fix (dispatch + sw.js) | Open — Round 12 verifies |
| C-028 | 2 | 19 | push_subscriptions delete is owner-scoped (user_id filter) on the admin client; table RLS must back it | R2 fix (R2-notif-1) | Open — Round 19 verifies RLS |
| C-029 | 3 | 8,17-19 | import_cases RPC is admin-gated AND row-capped (2000) at the DB; no later migration may re-grant to non-admin or remove the cap; clients must send NORMALIZED id/phone/email (returning-client + wa.me/tel rely on it) | mig 168 + dev behavioral check (prosrc) | Open — R17-19 verify final grants |
| C-030 | 3 | 19 | Admin-role permission rows are DB-protected (mig 169 BEFORE trigger blocks authenticated/anon writes); new permissions auto-grant to admin; has_permission must NOT short-circuit on is_admin — per-user overrides (incl. is_granted=false for an admin) are checked FIRST by design | mig 169 + dev behavioral check; verified vs 002_auth_core.sql override precedence | Open — R19 verifies |
| C-031 | 3 | 19 | profiles.is_protected marks the OWNER (Kaufman on prod) and is IMMUTABLE for authenticated/anon in both directions (mig 172 — no self-protect, no unprotect, no born-protected INSERT); guard lets service_role + direct-SQL recovery through (mig 171); at most ONE protected profile (single-owner unique index, 172); admin_delete_member runs reassign+cleanup+soft-delete atomically + re-checks admin/self/protected. Ownership moves MUST unset old before setting new (mig 170 documented order; the unique index is non-deferrable) | migs 170-172 applied dev+prod; 5-case behavioral proof + pgTAP test | Open — R19 verifies final state |
| C-032 | 4 | 5,10,19 | office_settings.retention_purge_enabled is the master kill-switch (default FALSE=paused) for ALL destructive purges — the pg_cron purge, the Vercel file-eraser cron, AND the manual permanent-delete RPC (mig 177 consumes it). No later migration may auto-enable it or add a destructive path that bypasses it | mig 173; consumed by mig 177 | Open — R10/R19 verify all purge paths honor it |
| C-033 | 5 | 6,8-10,14,19 | A new case (manual create AND lead conversion) is auto-assigned to its creator unless the creator holds view_all_cases (mig 176 BEFORE INSERT trigger). Case visibility/edit RLS depends on assigned_advisor_id never being left NULL by an end-user create | mig 176; pgTAP case_create_advisor_test.sql; applied + structs PASS on both deployment targets (Kaufman/Vercel production + Vultr staging); live UI smoke on Vultr | Open — R19 verifies final trigger + RLS |
| C-034 | 5 | 10,11,19 | permanently_delete_case raises PT001 for authenticated/anon while retention is paused (service_role/SQL recovery open); collectCaseFileRefs is FAIL-CLOSED (any read error aborts the delete, never deletes with empty refs); every leaked Storage/Drive pointer incl. the case folder is durably written to erasure_orphan_log (entity IN document/expense/case) | mig 177; pgTAP + 8 erase-case-files unit tests + permanent-delete-case action tests | Open — R10/R11 verify erasure/orphan reconciliation, R19 final state |
| C-035 | 5 | 6,8,19 | End-user case writes are DB-enforced: status_id requires change_case_status, assigned_advisor_id requires assign_case_to_user (mig 178 trigger, only-when-the-value-changes); case_properties INSERT/UPDATE/soft-delete authority = can_edit_case (associated advisors included), created_by un-forgeable AND write-once (migs 179-180). App-layer action gates are defense-in-depth, not the boundary | migs 178-180; pgTAP (case_trusted_columns_test, case_properties_authority_test plan 5); applied + structs PASS on both deployment targets (Kaufman/Vercel production + Vultr staging) | Open — R19 verifies final triggers/RLS |
| C-036 | 6 | 8,9,19 | Case-detail edit affordances MUST gate on can_edit_case (RPC) — status additionally on change_case_status, advisor on assign_case_to_user. The dashboard mirrors this per-row via domain/case-edit-gate.ts (edit_any_case OR edit_own_case AND assigned/associated). view_all_cases (canViewAll) is a VISIBILITY scope and must NEVER be used as an edit gate. This is UX-honesty (defense-in-depth); the DB (C-035 + RLS) is the real boundary. Incomes/obligations blocks still need this gate wired (R8/R9) | aceb724; case-edit-gate.test.ts (incl. view-only secretary); live regression smoke on Vultr | Open — R8/R9 extend to incomes/obligations; R19 re-verifies |

## Critical Workflow Gate

| Workflow | Primary | Verifier | Status | Evidence |
| --- | ---: | ---: | --- | --- |
| Login, reset, invite, session revocation | 1 | 19-20 | Statically reviewed; findings fixed+deployed; unit-tested (login/reset/rate-limit suites); lockdown verified live on prod | ROUND-01-HANDOFF.md §4, §8 |
| Shared UI, RTL/LTR, accessibility | 2 | 20 | Static review complete; 19 findings fixed+deployed; dynamic AT/visual + print/focus pending | ROUND-02-HANDOFF.md |
| Roles, settings, team administration | 3 | 19-20 | Complete; 21 findings + 1 deploy-caught guard bug (R3-team-4b) all fixed + DEPLOYED; migs 168-171 in prod; 338 tests + 4 migration behavioral checks green; prod owner = Kaufman | ROUND-03-HANDOFF.md |
| Landing, intake, consent, lead conversion | 4 | 5,19-20 | Static review complete; 11 findings fixed + DEPLOYED (migs 173-175); consent honest per source; retention master switch; deferred Lows + convert-consent-propagation (R4-xcut-2) open | ROUND-04-HANDOFF.md |
| Case create/edit/status/delete/restore | 5 | 19-20 | Static review complete; 2H+5M+2L fixed + DEPLOYED to both deployment targets (Kaufman/Vercel production + Vultr staging, migs 176-180); 4 consistency breaks closed; 368 tests + 4 pgTAP + 8 erase unit tests; **live functional smoke PASSED on Vultr staging** (6/6 areas); Kaufman-prod smoke intentionally skipped | ROUND-05-HANDOFF.md |
| Case workspace orchestration | 6 | 8-14,20 | Static review complete; 19 confirmed/3 refuted; edit-affordance gate (R6-inline-actions-1) + dead-code + polish fixed + DEPLOYED (aceb724→bc1cfa5, no migration); 375 tests + edit-gate unit tests; incomes/obligations gate + file-splits deferred | ROUND-06-HANDOFF.md |
| PDF/XLSX export | 7 | 20 | Not tested | Pending |
| Borrower identity and income editing | 8 | 19-20 | Not tested | Pending |
| Obligations, banks, expenses, receipts | 9 | 19-20 | Not tested | Pending |
| Upload, preview, delete, retention, erasure | 10 | 11,19-20 | Not tested | Pending |
| Drive sync, backup, restore | 11 | 19-20 | Not tested | Pending |
| Email, notifications, push, SLA | 12 | 13,19-20 | Not tested | Pending |
| Tasks, comments, mentions, attachments | 13 | 14,19-20 | Not tested | Pending |
| Activity timeline and statistics | 14 | 19-20 | Not tested | Pending |
| Simulator calculate/save/compare/report | 15-16 | 19-20 | Not tested | Pending |
| Final role/RLS enforcement | 17-19 | 20 | Not tested | Pending |
| Deploy, migration gate, health, rollback | 20 | Release owner | Not tested | Pending |

## Resource and Permission Matrix

Authorized coordinator: persist proposed resource rows after reviewing evidence.

| Resource | Type | Owner round | Read roles | Write roles | Sensitive fields | Evidence | Status |
| --- | --- | ---: | --- | --- | --- | --- | --- |

## Authorized Test Runs

| Date | Round | Command | Result | Evidence or failure |
| --- | ---: | --- | --- | --- |
| 2026-06-11 | Planning | `node scripts/check-review-coverage.mjs` | Pass | 1,030 files, zero unassigned |
| 2026-06-11 | 1 | `node scripts/check-review-coverage.mjs` (pre+post round) | Pass | 1,030 files, zero unassigned |
| 2026-06-11 | 1 | `vitest run` / `tsc --noEmit` / `eslint` / `next build` (post-fix, user-approved) | Pass | 317 tests; all clean; repeated on every push tree |
| 2026-06-11 | 1 | Migration 164 apply (dev via node+pg; prod by user) + REST lockdown probes | Pass | anon 401/42501 on consume+refund (dev AND prod); service 200/204 (dev) |
| 2026-06-11 | 1 | Vercel deploy verification (health gate 503→200; no-store fingerprint) | Pass | new build live on crm.kaufman-finance.com; bad prod server-actions key caught by new validation and rotated |
| 2026-06-12 | 1 | Migration 165 apply (dev); checklist release push `ad8b194..bca3732` | Pass | prod health 200 post-deploy |
| 2026-06-12 | 2 | `check-review-coverage.mjs` / vitest / tsc / eslint / next build (post-fix) | Pass | 1,050 files 0 unassigned; 329 tests; clean build |
| 2026-06-12 | 2 | Round-2 fix push `dbb70cc..2857614` (5 commits) + prod verify | Pass | /api/health 200; /robots.txt Disallow:/; no inter_ font live |
| 2026-06-13 | 3 | Blocker batch `423d73a,fb16140,7a91e50,478182c` pushed; migs 168-169 applied to prod by user | Pass | /api/health 200 post-apply |
| 2026-06-13 | 3 | Mig 168 behavioral (dev, node+pg, rolled back) | Pass | prosrc has is_admin + 2000 cap; unknown_status/advisor codes; inactive/deleted advisor rejected |
| 2026-06-13 | 3 | Mig 169 behavioral (dev, node+pg, rolled back) | Pass | authenticated JWT blocked from admin-role-perm writes (42501); permission INSERT auto-grants admin + audit row; overrides checked FIRST |
| 2026-06-13 | 3 | Mig 170 behavioral (dev, node+pg, rolled back) | Pass | owner marked is_protected; authenticated deactivate blocked ("protected"); admin_delete_member exists, is_admin-gated, refuses is_protected |
| 2026-06-13 | 3 | `vitest` / `tsc --noEmit` / `eslint` / `next build` (post-fix, all 21) | Pass | 338 tests (56 files); clean build (53/53 pages) |
| 2026-06-13 | 3 | 14-Low push `685912b..7a06ea7` (4 commits) → Vercel deploy; mig 170 applied to PROD by lead via node+pg (.env.kaufman-prod) BEFORE push (zero-downtime: old build saw 170≥169) | Pass | build 7a06ea7 live; deep health applied=170 expected=170; drive/keys ok |
| 2026-06-13 | 3 | Mig 171 (guard NULL-role fix) applied dev+prod via node+pg; behavioral both envs | Pass | authenticated still blocked from unprotect; direct-SQL now passes; schema 170→171 |
| 2026-06-13 | 3 | Prod owner marking corrected (Kaufman protected, operator released) via direct SQL | Pass | final active-admin roster: moshe7723 [PROTECTED], shh92533 [open], count=1 |
| 2026-06-13 | 3 | Mig 171 push `7a06ea7..da0d3fd` → Vercel deploy | Pass | build da0d3fd live; deep health applied=171 expected=171; all checks ok |
| 2026-06-13 | 3 | R3-team-4c (user-found): is_protected self-escalation, verified in prod (rolled back) | Confirmed | regular authenticated user self-set is_protected=true on own profile → SELF_PROTECT_SUCCEEDED |
| 2026-06-13 | 3 | Mig 172 (is_protected immutable + single-owner index) applied dev+prod via node+pg; 5-case behavioral proof both envs | Pass | self-protect→42501, normal self-update→OK, unprotect→42501, 2nd-protect→23505, direct-SQL unprotect→OK |
| 2026-06-14 | 4 | Migs 173-175 apply (dev via node+pg; prod by lead) + real PostgREST probe (3-arg submit_public_intake → 4-arg) | Pass | schema → 175; consent basis honest per source; 3-arg resolves to 4-arg |
| 2026-06-14 | 4 | R4 fix batch `2c82149..dff8f24` (5 commits) → Vercel deploy | Pass | build dff8f24 live; /api/health 200; schema 175 |
| 2026-06-14 | 5 | `vitest` / `tsc --noEmit` / `eslint` (post-fix, all approved findings) | Pass | **368 tests**; 0 type errors; 0 lint warnings |
| 2026-06-14 | 5 | Behavioral proofs (node+pg, rolled-back, dev) for migs 176-180 + 4 pgTAP files authored + 8 erase-case-files unit tests + permanent-delete-case action tests | Pass | default-advisor on create/convert; PT001 while paused; status/assign trigger only-when-changed; case_properties via can_edit_case; created_by write-once (42501); collectCaseFileRefs fail-closed; orphan rows on Storage/Drive/folder failure |
| 2026-06-14 | 5 | Migs 176-180 applied to **uknsayoyvffkxamofczy** (Kaufman prod, node+pg, apply-before-push); 7 struct checks | Pass | schema 175→180; all triggers/RPCs/CHECK present; retention still FALSE (paused) |
| 2026-06-14 | 5 | R5 fix batch `fbd5d6d..fb76e0b` (5 commits) `git push origin main` → Vercel deploy | Pass | deep-health build flipped aa981de→fb76e0b; schema applied=expected=180; db/drive/keys ok |
| 2026-06-14 | 5 | Migs 176-180 applied to **eyujzasggzjocsxakkoi** (Vultr staging, node+pg); 7 struct checks | Pass | schema 175→180; all structures present; retention FALSE |
| 2026-06-14 | 5 | Vultr deploy build fb76e0b via deploy.sh `SKIP_MIGRATIONS=1` (smoke :3798 → swap :3747 → health → rotate) | Pass | live + healthy; /api/health 200 {ok:true,db}; deep-health build fb76e0b, schema 180/180, db/cronSecret/keys ok; Drive degraded = expected staging baseline |
| 2026-06-14 | 5 | Live authenticated functional smoke on Vultr staging (Chrome, demo.advisor junior + demo.admin manager) | Pass (6/6) | create-as-non-view_all → case 2026-065 visible+editable, assigned+created_by=demo.advisor (DB-confirmed); status edit→document_collection persisted; manager-only fee/income hidden from junior + recycle-bin admin-only; case_properties write authority (updated_by=demo.advisor); recycle bin paused-banner + no countdown + permanent-delete disabled (no-op). QA case purged after |
| 2026-06-14 | 6 | Round-6 review (multi-agent Workflow: 5 dimension reviewers + adversarial verify, 27 agents) | Pass | 22 raw → 19 confirmed / 3 refuted (0 High, 1 Medium, 18 Low) |
| 2026-06-14 | 6 | `vitest` / `tsc --noEmit` / `eslint` (post-fix) + `check-review-coverage.mjs` | Pass | 375 tests; 0 type errors; 0 lint warnings; zero unassigned |
| 2026-06-14 | 6 | R6 fix commit `aceb724` (35 files; parallel email-attachments `8962f4b` + pre-existing `task-form-dialog.tsx` EXCLUDED) → push `main` → Vercel deploy | Pass | build aceb724 live (then bc1cfa5 after a parallel push); /api/health 200; schema 180/180; no migration |
| 2026-06-14 | 6 | Vultr staging deploy (`bc1cfa5` incl. aceb724, deploy.sh `SKIP_MIGRATIONS=1`) | Pass | live + healthy; deep-health build bc1cfa5, schema 180/180, db ok; Drive degraded = expected staging baseline |
| 2026-06-14 | 6 | Live edit-gate smoke on Vultr — POSITIVE/regression (demo.admin manager, Chrome) | Pass | case-detail status cell renders as an interactive button (chevron) + property block renders editable select/inputs → canEdit=true path unchanged for authorized users (gate didn't break editing). READ-ONLY/negative direction NOT live-checked: no demo secretary account, and flipping a demo role = access-control change (not done unilaterally); read-only logic covered by case-edit-gate.test.ts (view-only secretary persona) |

## Open Decisions and Accepted Risks

| Decision ID | Owner | Decision or risk | Reason | Revisit date | Status |
| --- | --- | --- | --- | --- | --- |
| D-001 | User | Distributed login attack can still deny one account (~20 failures/15min) | Full fix = CAPTCHA, out of MVP scope; per-(email,IP) keying protects the victim's own IP | Round 20 | Accepted |
| D-002 | User | Reset-timing floor (600ms) not dynamically measured against prod | Intrusive (real emails + fail-closed IP budget); unit tests + floor are standing evidence | Round 20 | Deferred ("not urgent") |
| D-003 | User | Stolen access JWT works vs raw REST API ≤ jwt_expiry after password change | Supabase JWT model; dashboard-bounded | Round 20 | Accepted (dashboard configured 2026-06-12) |
| D-004 | Parallel session | Anon can burn a victim-IP's public-contact budget (mig 165) | Page offers phone/WhatsApp alternatives; trivial impact | Round 19 | Accepted |
| D-005 | Dev | English UI uses a unified Heebo/Frank-Ruhl font stack, not the spec's Inter/Playfair | Consistent metrics across mixed He/En strings; dead Inter load removed; CLAUDE.md aligned (R2-assets-6) | If brand wants Inter/Playfair | Accepted (revisitable) |
| D-006 | Dev | R2-assets-8 (print) + R2-assets-9 (focus contrast) fixed as CSS but not visually confirmed | Static review only; effect needs a real browser/AT | Round 20 | Pending dynamic verify |
| D-007 | Dev | R3-import-7: re-running a successful import duplicates ID-less rows; mitigated by a best-effort read-side possible_duplicate WARNING, not a hard DB key | ID-less borrowers have no natural unique key; all-or-nothing + warning suffices for the one-time 80-case import | If recurring imports become a workflow | Accepted |
| D-008 | Dev | R3-settings-2: disableMfa requires only an authenticated session, not a fresh TOTP code | Matches Supabase's unenroll model; the session is already the auth boundary; low incremental risk | Round 20 | Accepted |
| D-009 | Dev | R3-roles-6: per-user permission overrides (FIRST precedence) have no management surface; only a static note was added | Override creation is a Phase-2 capability; the note prevents the false impression that the role grid is the complete picture | Phase 2 | Accepted |
| D-010 | Dev→Prod | Mig 170 (is_protected + atomic delete) | RESOLVED: applied to prod by lead via node+pg BEFORE push (zero-downtime, since the gate is applied≥expected); the 14-Low batch + migs 170-171 are deployed | 2026-06-13 | Closed |
| D-011 | User | Protected owner on Kaufman prod = Kaufman (moshe7723) only; the operator account (shh92533) is a normal admin | mig 170 auto-marked the earliest admin (the operator); user chose to protect the actual owner per R3-team-4's intent; corrected via direct SQL | If ownership moves (use mig 170's documented psql UPDATE; mig 171 makes that hatch work) | Accepted |
| D-012 | User | R4-public-api-1 fix scoped to a global hourly ceiling only (no per-victim suppression of web_contact prospect confirmations) | Global cap stops inbox-bombing; deeper suppression deferred; XFF-spoof residual is Low | Round 12 / Round 19 | Accepted |
| D-013 | User | R5 deferred ALL Low findings except R5-lifecycle-3 + R5-domain-logic-2; only 2 High + 5 Medium + those 2 Low were fixed this batch | Lows are correctness/quality, not security/data-loss blockers; routed to owning later rounds (R9/R10/R12/R13/R14) | Per owning round | Accepted |
| D-014 | User | R5 authenticated functional smoke run LIVE on Vultr staging (PASSED 6/6); intentionally SKIPPED on Kaufman prod | Staging runs the identical build+schema; a Kaufman-prod test case can't be permanent-deleted while retention is paused, so it would linger | If prod-specific coverage is wanted, manual click-through | Accepted (Vultr done; Kaufman-prod skip accepted) |
| D-015 | User→Prod | R5 fixes (migs 176-180, build fb76e0b) deployed to both deployment targets: Kaufman/Vercel production (uknsayoyvffkxamofczy) AND Vultr staging (eyujzasggzjocsxakkoi) | Both authorized + applied apply-before-push (zero-downtime); Vultr connected demo-account smoke PASSED 2026-06-14 | 2026-06-14 | Closed (DB + code + smoke) |
| D-016 | User | R6 edit-affordance gate (R6-inline-actions-1) shipped for the case-DETAIL page + dashboard, but NOT the incomes/obligations blocks (full-width grid items where a page-level fieldset breaks col-span) | The DB/RLS still blocks the writes (server-enforced); the UI-honesty gate for those two blocks belongs to their owning rounds (R8 incomes, R9 obligations) where it can be wired at the block level | R8 / R9 | Accepted (deferred) |
| D-017 | User→Prod | R6 fix deployed to BOTH targets via the `main` push (Vercel auto) + Vultr deploy.sh; landed as build bc1cfa5 (a parallel agent's task-dialog fix rode on top of aceb724) | No migration (schema 180); the gate is defense-in-depth so even a UI bug can't cause unauthorized writes | 2026-06-14 | Closed (DB n/a + code) |

## Areas Not Yet Verified

- Rounds 1-6 reviewed + approved fixes deployed; Rounds 7-20 unstarted. R5
  (migs 176-180) and R6 (build aceb724→bc1cfa5, no migration) fixes are live on
  both deployment targets (Kaufman/Vercel production + Vultr staging); dynamic
  AT/visual verification still pending across rounds.
- R5 authenticated functional smoke PASSED live on Vultr staging (6/6 areas);
  intentionally skipped on Kaufman prod (D-014).
- R6 edit-affordance gate: incomes/obligations blocks NOT yet gated (D-016, R8/R9);
  live read-only smoke for a view-only/secretary persona pending (no demo secretary
  account; logic is unit-tested via case-edit-gate.test.ts).
- Dev DB is MISSING parallel-session migrations 166-167 (schema_version: 165 then
  168-170). Not Round 3's domain — flagged for the migration rounds (17-19).
- Existing review documents (`RELEASE_REVIEW.md`, `docs/UI_UX_REVIEW.md`) contain
  leads not yet revalidated under this coordinated review.
- The coverage baseline (1,030) predates landing/ + intake + web-lead additions;
  current total is 1,050 files, zero unassigned (the /api/web-lead classifier gap
  found in Round 2 is fixed). Per-round file counts in the baseline table are stale
  but the zero-unassigned invariant holds.
- Prod Supabase Auth dashboard values are user-attested, not API-verified (C-021).
