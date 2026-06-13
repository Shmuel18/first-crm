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
| 4 | Leads, public intake, landing, consent, legal | Not started | Pending |
| 5 | Case lifecycle core, dashboard, lists, services | Not started | Pending |
| 6 | Case workspace UI and orchestration | Not started | Pending |
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

## Cross-Round Contracts

Authorized coordinator: persist proposed contract updates after reviewing
evidence.

| Contract ID | Producer | Consumers/verifiers | Contract | Evidence | Status |
| --- | ---: | --- | --- | --- | --- |
| C-001 | 1 | 17-20 | App authorization helpers match final RLS/RPC grants | R1 found+fixed one drift (R1-authz-1: userCanEditCase now delegates to can_edit_case RPC) | Open — R19 re-verifies |
| C-002 | 2 | 4-16,20 | Shared UI/i18n primitives work correctly in product contexts | Pending | Open |
| C-003 | 3 | 17-20 | Admin, team, audit, and import permissions match database controls | R3 hardened: import is_admin-gated (mig 168), admin-role perms trigger-protected (mig 169), member-delete atomic + protected-owner-aware (mig 170); audit now covers composite-PK permission tables | Partially verified — R19 re-verifies final grants |
| C-004 | 4 | 5,19,20 | Public intake preserves consent and converts safely | Pending | Open |
| C-005 | 5 | 6,8-10,14,19,20 | Case lifecycle and visibility rules are consistent | Pending | Open |
| C-006 | 6 | 8-14,20 | Case workspace composes child domains without leaks or stale state | Pending | Open |
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

## Critical Workflow Gate

| Workflow | Primary | Verifier | Status | Evidence |
| --- | ---: | ---: | --- | --- |
| Login, reset, invite, session revocation | 1 | 19-20 | Statically reviewed; findings fixed+deployed; unit-tested (login/reset/rate-limit suites); lockdown verified live on prod | ROUND-01-HANDOFF.md §4, §8 |
| Shared UI, RTL/LTR, accessibility | 2 | 20 | Static review complete; 19 findings fixed+deployed; dynamic AT/visual + print/focus pending | ROUND-02-HANDOFF.md |
| Roles, settings, team administration | 3 | 19-20 | Complete; 21 findings + 1 deploy-caught guard bug (R3-team-4b) all fixed + DEPLOYED; migs 168-171 in prod; 338 tests + 4 migration behavioral checks green; prod owner = Kaufman | ROUND-03-HANDOFF.md |
| Landing, intake, consent, lead conversion | 4 | 5,19-20 | Not tested | Pending |
| Case create/edit/status/delete/restore | 5 | 19-20 | Not tested | Pending |
| Case workspace orchestration | 6 | 8-14,20 | Not tested | Pending |
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

## Areas Not Yet Verified

- Rounds 4-20 are unstarted (Rounds 1-3 done+deployed; Round 3 fully deployed —
  all 21 findings + the deploy-caught guard bug fixed, migs 168-171 in prod;
  dynamic AT/visual verification pending across all rounds).
- Dev DB is MISSING parallel-session migrations 166-167 (schema_version: 165 then
  168-170). Not Round 3's domain — flagged for the migration rounds (17-19).
- Existing review documents (`RELEASE_REVIEW.md`, `docs/UI_UX_REVIEW.md`) contain
  leads not yet revalidated under this coordinated review.
- The coverage baseline (1,030) predates landing/ + intake + web-lead additions;
  current total is 1,050 files, zero unassigned (the /api/web-lead classifier gap
  found in Round 2 is fixed). Per-round file counts in the baseline table are stale
  but the zero-unassigned invariant holds.
- Prod Supabase Auth dashboard values are user-attested, not API-verified (C-021).
