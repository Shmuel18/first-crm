# Round 02 Handoff — Shared UI, Design System, App Shell, PWA, i18n

> Written by the documentation coordinator with user authorization (2026-06-12).
> Review was read-only; all findings were then FIXED, COMMITTED, and DEPLOYED to
> production in the same session. Statuses below are final.

## 1. Scope Promised

- src/components/**, src/features/pwa/**, src/i18n/**, messages/**, public/**,
  src/app/globals.css, protected (app) shell layouts/states, docs/mockups/**
  (72 files per the baseline).

## 2. Scope Actually Reviewed

- A 6-cluster workflow lost 4 clusters to a session limit; those
  (ui-form-controls, ui-overlays-surfaces, app-shell-nav, i18n-catalogs) were
  re-reviewed DIRECTLY by the lead. PWA + css-tokens-assets came from the
  workflow.
- All PWA, shell, layout/shared, and high-risk UI primitives read in full.
- 6 low-risk stock primitives (textarea/button/card/badge/table/currency-sign/
  loading-logo) were grep-scanned for auto-reject patterns, not line-read.
- Catalogs machine-checked (parity/ICU/plurals/HTML-values) + sampled.
- NO dynamic/visual/AT testing was performed — all findings are static. The two
  Suspected findings (print truncation, focus-contrast) were fixed with sound
  CSS but their real-world effect is not yet visually confirmed.

## 3. Files / Coverage

- The coverage gate FAILED mid-round on two unassigned files
  (src/app/api/web-lead/route.ts + route.test.ts). FIXED: the classifier now
  maps /api/web-lead → Round 4. `node scripts/check-review-coverage.mjs` →
  1,050 files, zero unassigned, exit 0. (The script itself is untracked review
  tooling; the fix lives in the working file.)

## 4. Routes / Flows Reviewed

| Flow | Result | Evidence |
| --- | --- | --- |
| App shell bootstrap + skip-link + route-focus | Pass | (app)/layout.tsx, route-focus.tsx |
| Nav active-state (desktop/mobile) | Pass (boundary-slash match) | is-nav-item-active.ts |
| Locale switch + logout (user-menu) | Fixed (ARIA + logout PWA cleanup) | user-menu.tsx |
| PWA install / SW / push / offline | Fixed (R2-pwa-1..7) | sw.js, install-*, app-badge-sync, cleanup-pwa-session |
| Push unsubscribe authorization | Fixed (R2-notif-1 IDOR) | unsubscribe-push.ts, push-subscriptions.service.ts |
| Rich-text + email compose (XSS surfaces) | Safe (TipTap parse + textToHtml escape) | rich-text-editor.tsx, compose-email-dialog.tsx |
| Dialog/alert/tooltip/dropdown a11y | Pass (Base UI) | ui/*.tsx |
| Catalogs he/en | Parity perfect, plurals correct | messages/*.json |

## 5. External Contracts Touched

| Contract | Type | Owner | Status |
| --- | --- | --- | --- |
| push_subscriptions delete (owner-scoped) | service+RLS | 12/19 | Fixed (user_id filter); R19 verifies the table RLS |
| Web Push payload (PII-free + lang/dir) | push | 12 | lang/dir now set per recipient (C-027) |
| sw.js cache scope (no app data) | service worker | 20 | Confirmed network-passthrough; CACHE v3 |
| offline.html / layout polyfill (un-nonceable inline) | CSP | 20 | offline inline handler removed; layout polyfill remains (C-026) |
| layout_bootstrap RPC (is_admin/badges) | RPC (mig 066) | 3/17-19 | UI gating only — server-enforce admin/statistics elsewhere |
| t.rich consent renderer | i18n | 4 | Confirmed safe |

## 6. Findings — all FIXED + DEPLOYED (commits dbb70cc..2857614)

| ID | Severity | Status | Owner | Verify | Summary |
| --- | --- | --- | ---: | ---: | --- |
| R2-notif-1 | Medium | Fixed | 12 | 19 | IDOR: push-unsubscribe deleted by endpoint alone on the admin client; now owner-scoped (+test) |
| R2-pwa-1 | Medium | Fixed | 2 | — | Logout left device badge + push subscription; cleanupPwaSession (timeout-guarded) tears them down |
| R2-shell-1 | Low | Fixed | 2 | — | user-menu role=menu without arrow-key model → labeled disclosure |
| R2-form-1 | Low | Fixed | 2 | — | date-picker Today/Clear hardcoded → common.today/clear |
| R2-form-2 | Low | Fixed | 2 | — | FormField label id derived from child's own id |
| R2-ui-1 | Low | Fixed | 2 | — | select/dropdown physical pl/pr → logical pe/ps |
| R2-pwa-2 | Low | Fixed | 12 | — | Notifications hardcoded he/rtl → per-locale lang/dir |
| R2-pwa-3 | Low | Fixed | 2 | — | InstallBanner role=dialog → status; 44px dismiss |
| R2-pwa-4 | Low | Fixed | 2 | — | offline.html bilingual |
| R2-pwa-5 | Low | Fixed | 2 | 20 | offline inline onclick → CSP-safe link |
| R2-pwa-6 | Low | Fixed | 2 | — | SW navigation fallback guarded against undefined |
| R2-pwa-7 | Low | Fixed | 2 | — | install components explicit return types |
| R2-assets-1 | Low | Fixed | 2 | — | robots.ts added (Disallow: /) — live in prod |
| R2-assets-2 | Low | Fixed | 2 | — | template SVG cruft + banks/.gitkeep deleted |
| R2-assets-5 | Low | Fixed | 2 | — | dead .dark palette removed (variant kept) |
| R2-assets-6 | Low | Fixed | 2 | — | dead Inter load dropped; CLAUDE.md brand table aligned to shipped unified stack |
| R2-assets-7 | Low | Fixed | 2 | — | global prefers-reduced-motion clamp |
| R2-assets-8 | Low | Fixed | 2 | 20 | @media print restores document flow (dynamic confirm pending) |
| R2-assets-9 | Low | Fixed | 2 | 20 | global :focus-visible AA-safe fallback (dynamic confirm pending) |

Non-findings explicitly cleared: rich-text-editor XSS (TipTap parse), compose-email
XSS (server textToHtml escape), dialog/alert/tooltip a11y (Base UI), i18n timeZone
(no next-intl formatter used), Hebrew plural correctness, loading/not-found/error states.

## 7. Verification Run (all green post-fix)

| Check | Result |
| --- | --- |
| node scripts/check-review-coverage.mjs | 1,050 files, 0 unassigned |
| tsc --noEmit / eslint | clean |
| vitest | 329 pass (incl. new IDOR ownership test) |
| next build | clean; /robots.txt generated |
| prod after deploy | /api/health 200; /robots.txt = Disallow:/; no inter_ font loaded |

## 8. Contracts Proposed Confirmed
- Shared UI XSS surfaces safe; he↔en parity + ICU + Hebrew plurals correct.
- robots.txt + font cleanup verified live in production.

## 9. Contracts Requiring Later Verification
- C-002 (shared UI/i18n in product contexts — rounds 4-16), C-026 (CSP, round 20),
  C-027 (push lang/dir, round 12), and the push_subscriptions RLS (round 19).

## 10. Residual Risks
- R2-assets-8/9 fixes are sound CSS but not visually confirmed (print output, focus
  visibility) — dynamic verification deferred to Round 20.
- No AT/visual/RTL render testing this round (static only).

## 11. Instructions for Round 3 (Administration, Team, Settings, Audit, Import)
- Read this handoff + MASTER_LEDGER first; coverage now passes 1,050/0.
- Scope: src/features/{settings,team,audit,import}/**, admin/settings/team/audit routes.
- Inherit: (a) sidebar/bottom-nav UI gating (statistics adminOnly, canCreateCase) is
  UX-only — confirm server-side enforcement on admin/settings actions;
  (b) /settings/display hosts InstallAppControl; (c) compose-email-dialog is the shared
  send surface consumed by email/template settings; (d) new user-facing strings must hit
  BOTH catalogs (parity currently perfect, 1,947=1,947).
