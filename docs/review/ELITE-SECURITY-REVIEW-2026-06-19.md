# Elite Enterprise Security Review — Kaufman Finance Group CRM

**Date:** 2026-06-19
**Scope:** Full application — Next.js 16 + Supabase (PostgreSQL/RLS), Vercel (client prod) + self-hosted Vultr (staging), Google Drive integration, Resend email, Web Push.
**Data sensitivity:** Highly sensitive — Israeli mortgage cases (national IDs, incomes, obligations, bank details, agreed fees).

## Methodology & Honest Caveat

This review simulated **20 independent security teams** as a multi-phase AI agent workflow (**73 agents, ~5.5M tokens, 1,013 tool calls**):

1. **Recon** (8 agents) mapped auth/session, RLS + SECURITY DEFINER RPCs, the public/anon surface, file/storage, crypto/secrets, backup/retention, and infra/CI.
2. **20 team reviews** read real code and were required to cite `file:line` and explain why an *existing* guard fails before reporting.
3. **Triage** deduped 39 raw findings → 34 unique issues.
4. **Adversarial verification** checked each issue against the actual RLS policies / `can_edit_case` / server-action auth / rate-limits; Critical/High got a two-lens (prove-exploit vs. prove-defended) check. **28 survived, 6 were refuted.**
5. **Independent scoring.**

**This is not a substitute for a human penetration test** (no live exploitation, no runtime fuzzing, no auth-flow dynamic testing). It is a rigorous static + reasoning review. Treat confirmed findings as high-confidence leads, and re-validate the High/Medium items against your live Supabase project settings before acting.

The codebase has been through ~18 prior hardening rounds, and it shows: the verification phase **refuted 6 of the scariest-sounding findings** because the defenses genuinely hold (see Appendix). The real residual risk is concentrated in a small number of authorization and privacy gaps.

---

## 1. Executive Security Summary

The platform demonstrates **mature, defense-in-depth engineering well above the norm for a solo-built MVP**: layered fail-closed login rate limits (IP + per-email + global), refresh-token rotation, magic-link-only invites (no temp passwords), SECURITY DEFINER session revocation, a mid-session deactivation gate, consistent server-action discipline (`getUser` / Zod / `Result<T,E>` / `userCanEditCase` across ~115 actions), generic error returns (no raw Supabase errors leaked), AES-256-GCM encryption of OAuth tokens and backups with key domain-separation, RLS on every table, audit triggers on business tables, and self-signup guarded by a profile-creation trigger.

**However, two confirmed authorization/privacy defects keep it out of the "minor risks" tier:**

- **HIGH — Cross-case borrower PII IDOR (ISS-02):** all three SECURITY DEFINER borrower-write RPCs deduplicate borrowers by a **global, RLS-bypassing `national_id` lookup**, then link the matched borrower to the *caller's* case. Any authenticated advisor who knows/guesses a 9-digit Israeli ID can pull another office client's full PII (and overwrite their contact details). This breaks the core confidentiality guarantee a mortgage CRM must not break.
- **MEDIUM — `case_financials` cross-case access (ISS-01):** the RLS on the manager-only fee table is gated **only** on the configurable `view_case_fee` permission, with no `can_view_case` join — so any non-admin granted that permission gets cross-case read/write of every case's fee and expected income.

Beyond those: a cluster of **GDPR/Israeli-PPL right-to-erasure gaps** (borrower and converted-lead PII persist forever), **forensic blind spots** (single-record PII disclosure and two new financial tables are unaudited), **cost-amplification/notification-bomb** vectors (unrate-limited task/comment fan-out), and **DR fragility** (backups share the live Drive token and a single destination).

**Verdict: ⚠ SAFE WITH MAJOR RISKS (overall 6/10).** Deployable on the Vercel/HTTPS client instance with compensating controls, but ISS-02 (High) and ISS-01 (Medium) should be treated as **launch-blocking** for a regulated-data product, and the erasure + DR gaps need a near-term plan.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 7 |
| Low | 19 |
| Informational (verified-down to None) | 1 |
| **Refuted / by-design** | **6** |

---

## 2. Critical Findings

**None.** No finding survived verification at Critical severity. The most dangerous candidate (direct PostgREST `DELETE` on `cases` destroying any case — claimed High/Critical) was **refuted**: migration `022_security_hardening.sql:257` drops the `cases_delete` policy and nothing recreates it, so RLS default-deny kills the attack at 0 rows (see Appendix ISS-21).

---

## 3. High Findings

### ISS-02 — Cross-case borrower PII disclosure & tampering via global `national_id` dedup in SECURITY DEFINER borrower-write RPCs

- **Severity:** High (exploitation confirmed)
- **Category:** Broken Access Control / IDOR (cross-tenant PII exfiltration + tampering)
- **Location:** `supabase/migrations/190_canonical_can_edit_case_borrower_income_writes.sql:173-196` (`save_borrower_for_case_full`); `supabase/migrations/142_create_case_draft_all_roles.sql:99-104,175-182` (`create_case_draft`); `supabase/migrations/152_convert_lead_rich_intake.sql:106-147` (`convert_lead_to_case`). Entry points: `src/features/borrowers/actions/save-borrower.ts:46-56`, `src/features/leads/actions/convert-lead.ts`.
- **Description:** All three SECURITY DEFINER borrower-write RPCs deduplicate by `SELECT id FROM borrowers WHERE national_id = <attacker-supplied> AND deleted_at IS NULL` — a **global lookup that bypasses RLS** (DEFINER context). The matched borrower (possibly another advisor's client) is then linked to the **caller's** case via `case_borrowers`. Once linked, `borrowers_select` / `incomes_select` / `obligations_select` RLS (scoped via `can_view_case` on the *linked* case) return the victim's full record. `create_case_draft`'s ELSE branch and `save_borrower_for_case_full` then **overwrite** the matched borrower's phone/email/birth_date with attacker values. The dedicated returning-client lookup (`searchReturningBorrowers`) was deliberately RLS-scoped + rate-limited to prevent exactly this enumeration — these RPCs are the unguarded back door.
- **Exploitation scenario:**
  1. Attacker is any authenticated advisor with `create_case`/`create_lead` (includes the lowest `junior_advisor`).
  2. Knows or guesses a 9-digit Israeli national ID (small keyspace; trivially enumerable for a targeted person).
  3. Creates a case draft / adds a borrower to their own case / converts their own lead, supplying that `national_id`. The only gate is `userCanEditCase` on the **attacker's own** case — which passes.
  4. The RPC dedups globally, finds the victim's borrower row, links it to the attacker's case.
  5. Attacker reloads their case → reads the victim's full PII (name, phone, email, address, employment, citizenship, incomes, obligations).
  6. Tampering variant: a different phone/email overwrites the victim's contact fields on the shared record.
- **Business impact:** Direct breach of client confidentiality for a regulated financial-PII product; reportable under Israeli PPL / GDPR; reputational and contractual damage with a mortgage office whose entire value is client trust.
- **Technical impact:** Cross-tenant read of national IDs + financials + identity; cross-tenant write (data integrity corruption) of shared borrower records.
- **Recommended fix:** Before reusing a `national_id`-matched borrower, verify the **caller already had access** to it (the matched borrower must already be on at least one case the caller `can_view`). If not, create a fresh borrower row scoped to the new case, or `RAISE` a conflict. Apply consistently in `create_case_draft` (142), `save_borrower_for_case_full` (190), `convert_lead_to_case` (152). Never overwrite an existing borrower's contact fields from these paths unless the caller already had edit access to that borrower.
- **Priority:** **P0 — launch-blocking.**

---

## 4. Medium Findings

### ISS-01 — `case_financials` RLS lacks case-scoping (cross-case IDOR on manager-only financials)
- **Category:** Broken Access Control / IDOR. **Exploitation confirmed.**
- **Location:** `supabase/migrations/027_production_hardening.sql:144-151`; `upsert_case_financials` RPC `027:207-235`; `src/features/cases/services/case-lookups.service.ts:51-61`; `src/features/cases/actions/update-case-fee-amount.ts:47-74`.
- **Description:** RLS on `case_financials` (holds `fee_amount` + `expected_income`) is gated **only** on `has_permission('view_case_fee')` — no `can_view_case`/`can_edit_case` predicate, no join to `cases`. Every sibling per-case financial table (incomes/obligations mig 039/190, expenses/properties mig 156/179/192, scenarios mig 195) binds to the case row; this one does not. The `upsert_case_financials` RPC (SECURITY INVOKER) likewise checks only the permission then writes whatever `p_case_id` is passed. `view_case_fee` is admin-configurable (not in `HIDDEN_PERMISSION_KEYS`) and designed to be grantable to non-admins (mig 117 had to retroactively revoke it from `senior_advisor`).
- **Exploitation:** Manager grants `view_case_fee` to a non-admin → that advisor issues `GET /rest/v1/case_financials?case_id=eq.<any-uuid>` with their JWT → RLS returns the row → enumerate case IDs to harvest the whole office fee book; or `upsert_case_financials` with any `p_case_id` to silently alter another advisor's fee. Direct PostgREST bypasses the page-level `can_view_case` gate entirely.
- **Business/technical impact:** Cross-case disclosure and tampering of the *most* sensitive manager-only fields. Mitigating fact (keeps it Medium, not High): out-of-the-box only the manager holds `view_case_fee`, and the manager already sees all cases — so the gap only manifests once an admin grants the permission to a non-admin.
- **Fix:** Scope both policies to the row's case (mirror incomes mig 039 / expenses mig 192): `USING (has_permission('view_case_fee') AND public.can_view_case(case_id))`; split modify into INSERT/UPDATE with `WITH CHECK (... AND public.can_edit_case(case_id))`. Fold `can_edit_case` into `upsert_case_financials`. Fix the stale "admin RLS" comment at `case-lookups.service.ts:53`.
- **Priority:** **P0 — launch-blocking** (cheap one-migration fix).

### ISS-18 — Converted public-intake lead retains full PII + consent payload forever (right-to-erasure failure)
- **Category:** Privacy / Right-to-erasure (Israeli PPL / GDPR Art. 17). **Confirmed.**
- **Location:** `175_intake_source_basis.sql:125-138`; `152_convert_lead_rich_intake.sql:210-215`; `144_retention_erasure_observability.sql:171`.
- **Description:** A `/check` submission writes the entire questionnaire (every borrower's national_id, birth_date, address, employer, income, plus consent) into `leads.metadata.payload`. `convert_lead_to_case` stamps the lead `status='converted'` but leaves `deleted_at NULL`. The retention purge only deletes leads `WHERE deleted_at IS NOT NULL`, so a converted lead is **never purged** — a complete indefinite shadow copy of the subject's financial PII, independent of the case. Even permanently deleting the case doesn't touch the originating lead.
- **Exploitation:** Subject exercises right-to-erasure → admin purges the case → the full PII payload survives in `leads.metadata.payload` indefinitely; erasure is incomplete and unverifiable.
- **Fix:** On `convert_lead_to_case`, set `leads.deleted_at = now()` (so the purge reaches it) **or** null/minimize `metadata.payload` keeping only the slim consent record. Make `permanently_delete_case` also redact any lead whose `converted_to_case_id` matches.
- **Priority:** **P1.** (Tracked in `RELEASE_REVIEW.md`.)

### ISS-19 — No right-to-erasure for borrower entities (national ID + financial PII persists after last case purged)
- **Category:** Privacy / Right-to-erasure. **Exploitation confirmed.**
- **Location:** `src/features/borrowers/actions/remove-borrower-from-case.ts:60-78`; `177_permanent_delete_retention_guard.sql:63-67`; `144_retention_erasure_observability.sql:217`.
- **Description:** Borrowers are deduplicated by `national_id` and shared across cases via `case_borrowers`. Removing a borrower deletes only the junction row; the `borrowers` row persists. `permanently_delete_case` deletes only `cases` (cascades through the junction, but `borrowers` has no FK to `cases`). **No code path ever sets `borrowers.deleted_at`**, and there is no `permanently_delete_borrower` RPC — so the retention purge can never collect an orphaned borrower. A borrower's national ID + PII is created once and is never erasable. (Flagged `PRIV-erasure-borrower` (P1) in `RELEASE_REVIEW.md`, still open.)
- **Fix:** Add an admin-only `permanently_delete_borrower(borrower_id, confirm_national_id)` SECURITY DEFINER RPC (erases blobs + hard-deletes, firing the mig-133 audit redaction), plus an orphan-borrower sweeper that sets `deleted_at` when no surviving `case_borrowers` link exists.
- **Priority:** **P1.**

### ISS-24 — Single-record PII disclosure paths leave no audit trail (forensic gap)
- **Category:** Audit-trail completeness / Forensics. **Exploitation confirmed.**
- **Location:** `src/features/cases/actions/generate-bank-pdf.tsx:33-76`; `get-document-preview-url.ts:44-58`; `get-document-preview-urls.ts`; `get-expense-receipt-url.ts`; `audit-writer.ts:5-32`; `src/app/api/exports/cases/route.ts:161`.
- **Description:** The only manual read-audit writer (`logCasesExport`) is wired into exactly one site — the **bulk** export route. Every other path that exports the same PII class is **silent**: `generateBankPdfAction` (full dossier: national IDs, incomes, obligations, bank details, DTI), `getDocumentPreviewUrlAction` (300s signed URLs to scanned IDs/bank statements), the batch thumbnail variant, and the expense-receipt URL action. Per-row DB triggers fire only on INSERT/UPDATE/DELETE — reads are invisible.
- **Exploitation:** A malicious/compromised advisor session downloads every visible case's PDF and signed-URL documents; an admin investigating later finds **nothing** in `audit_log` (only bulk-export rows exist, which the attacker never touched). The national-ID breach is forensically invisible.
- **Fix:** Add `logPiiDisclosure` to `audit-writer.ts` (action `EXPORT`/`DISCLOSE`, `record_id=caseId`, `changed_fields={kind, documentId?, count?}`) and call it best-effort after authorization in the four read paths, mirroring `logCasesExport`.
- **Priority:** **P1.**

### ISS-27 — Backups share the live app's full-Drive OAuth token and a single destination (no ransomware/off-site resilience)
- **Category:** Disaster Recovery. **Partial (availability threat; gated on prior compromise).**
- **Location:** `drive-backup.service.ts:5-35`; `src/app/api/cron/backup/route.ts:38-61`; `google-oauth.ts:7-9,24-27` (full `drive` scope); `drive-case-uploader.ts:31-32`.
- **Description:** Backups are written to `KFG_Backups` inside the **same** Drive account the app uses for live document sync, with the **same** OAuth token holding the full `https://www.googleapis.com/auth/drive` scope (read + overwrite + delete + trash). No independent append-only/immutable destination, no enforced versioning, no separate credential. `BACKUP_ENCRYPTION_KEY` and the Drive token are reachable from the same server process/env file. The staleness watchdog only detects a *missing* new backup after 26h — it cannot prevent destruction of existing backup history.
- **Exploitation:** A single compromise (leaked `INTEGRATION_ENCRYPTION_KEY` → decrypt Drive token, Google-account takeover, or host compromise) lets an attacker delete every live case folder **and** every `KFG_Backups` file in one pass. Same outcome from a benign Drive-account loss or a lost `BACKUP_ENCRYPTION_KEY` (no escrow). Note: no *application-layer* guard is bypassed — this is a blast-radius/architecture risk.
- **Fix:** Write backups to an independent destination with a distinct credential the live-sync token cannot reach, made tamper-evident — S3 Object Lock (WORM) or a separate cloud account. If Drive must remain, enforce versioning + a create-only (no-delete) service account on the backup folder. Escrow `BACKUP_ENCRYPTION_KEY` separately. Document + test a full restore from the independent copy.
- **Priority:** **P1.**

### ISS-30 — `postCaseCommentAction` has no rate limit (unbounded @mention push/email fan-out)
- **Category:** Cost amplification / DoS. **Exploitation confirmed.**
- **Location:** `src/features/case-comments/actions/post-case-comment.ts:24-53`; `194_scope_mention_notifications_to_case_task_viewers.sql:138-180`; `src/app/api/push/dispatch/route.ts:58`. Contrast: `add-task-comment.ts:29-36` (rate-limited 60/60s).
- **Description:** Any user passing `case_comments` RLS can insert comments with **no rate limit**. Each `@[name](uuid)` token fires `notify_case_comment_mentions()` → one notification per mentioned viewer → Supabase webhook → `/api/push/dispatch` → Web Push **and** a mirrored Resend email. A 5000-char body holds ~70 mention tokens. The structurally identical *task*-comment path was deliberately rate-limited; the case path was left ungated.
- **Exploitation:** Enumerate colleague UUIDs via `list_case_mentionable_profiles` (authenticated-callable) → loop `postCaseCommentAction` packing ~70 mentions → each call sends N pushes + N metered Resend emails → floods bells/inboxes and burns the office Resend quota.
- **Fix:** Add `checkRateLimit({action:'post_case_comment', subject:'user:<uid>', max:60, windowSeconds:60, failMode:'open'})` after `getUser()`; cap distinct mentions per comment.
- **Priority:** **P1.**

### ISS-07 — Self-hosted Vultr container served over plaintext HTTP on `0.0.0.0:3747`
- **Category:** Network / Transport Security. **Confirmed — scoped to the self-hosted staging/secondary instance, NOT the Vercel client production (which is HTTPS).**
- **Location:** `scripts/deploy.sh:195-196` (`docker run -p "$PORT:$PORT"` binds 0.0.0.0); `docs/FRANKFURT_MIGRATION_HANDOFF.md:148` (`NEXT_PUBLIC_APP_URL=http://104.207.131.136:3747`); `next.config.ts:36-37,74-76` (HSTS/upgrade-insecure-requests only when HTTPS).
- **Description:** On the self-hosted Vultr deployments the app is reachable at `http://<public-ip>:3747` over plaintext HTTP. `@supabase/ssr` can't set `Secure` on auth cookies over HTTP, and HSTS is omitted. The verifier confirmed **client production = Vercel `https://crm.kaufman-finance.com` (HTTPS, HSTS engaged)**, so this is a staging/secondary exposure — but that staging instance holds real PII.
- **Exploitation:** Anyone on the network path (shared Wi-Fi, ARP/DNS spoof, compromised router) sniffs Supabase cookies in cleartext → session replay → advisor/manager impersonation; capture `/login` credentials; MITM-inject responses (no HSTS).
- **Fix:** Bind container to `127.0.0.1:3747`, front with an nginx HTTPS reverse proxy + Let's Encrypt, set `NEXT_PUBLIC_APP_URL=https://<host>`. Never expose the Next.js port directly on a public interface over HTTP.
- **Priority:** **P1 for the Vultr instance** (no impact on Vercel client prod).

---

## 5. Low Findings

> Compact form (each: ID — title · fix · priority). All survived verification at Low; full detail in the workflow output.

| ID | Title | Fix summary | Priority |
|---|---|---|---|
| ISS-03 | **Blind SSRF** — Web Push `endpoint` validated only as `z.string().url()`, POSTed server-side with no host allowlist (`subscribe-push.ts:16-20`, `push-sender.ts:55-70`). *Note: `web-push` forces HTTPS, defanging `http://` internal targets — residual risk is HTTPS-internal hosts.* | Parse with `new URL()`, enforce `https:`, reject private/loopback/link-local ranges, allowlist known push-service host suffixes. | P2 |
| ISS-04 | **Task assignment grants durable case read** — assigning any active user to a task on a case grants them full `can_view_case` read of that case's PII, persists after completion (`182_task_member_case_access.sql`, `create-task.ts`). | In `tasks_insert` WITH CHECK, require `assigned_to` to already satisfy `can_view_case_for(assigned_to, case_id)`; or make membership non-durable (exclude completed). | P2 |
| ISS-05 | **Inconsistent fee authorization** — `case_payouts` hardcodes `is_admin()` while `case_financials` honors configurable `view_case_fee`; fails closed but a granted permission is only half-honored (broken UX). | Pick one predicate for the fee-data class across RLS + app gates. | P3 |
| ISS-06 | **`prepareEmailAttachmentAction` no rate limit** + email-tmp blobs cleaned only on send → storage exhaustion (`prepare-email-attachment.ts:30-58`). | Add `checkRateLimit` (120/min) mirroring `prepare-upload.ts`; sweep stale `email-tmp/` blobs in the orphan cron. | P2 |
| ISS-08 | **Container runs as root** with no `--cap-drop`/`--read-only`/`no-new-privileges` on a shared Vultr host (`Dockerfile:23-41`, `deploy.sh:195-196`). | Add non-root `USER`; harden `docker run` flags; isolate the PII workload from co-tenant crypto-bot. | P2 |
| ISS-09 | **`bank-logos` public bucket** accepts client-controlled content-type + SVG, no server-side MIME/magic-byte validation (`158_bank_logos_bucket.sql`, `bank-form-dialog.tsx`). Admin-gated; abuse = stored phishing page on the `*.supabase.co` origin. | Set bucket `allowed_mime_types` (drop SVG) + `file_size_limit`; route through a server action with `fileTypeFromBuffer` sniff. | P2 |
| ISS-10 | **`case_docs_delete` storage policy gated on `can_view_case` not `can_edit_case`** — a `delete_document` holder with broad view can permanently erase blobs on cases they can't edit, bypassing soft-delete/retention (`040_storage_rls_can_view_case.sql:28-34`). Default roles don't expose it, hence Low. | New migration: require `can_edit_case((storage.foldername(name))[1]::uuid)` for DELETE. | P2 |
| ISS-11 | *(Informational — adjusted to None)* Drive-synced docs store unsanitized `file_name`/MIME; verifier found every downstream sink (preview, email, audit, UI) independently escaped/closed. | Run `sanitizeFilename(file.name)` in `drive-sync-importer.ts` for defense-in-depth. | P3 |
| ISS-12 | **High-severity `hono` advisory shipped in prod image** — `shadcn` (a dev CLI) is in `dependencies`, dragging `@modelcontextprotocol/sdk` → `hono@4.12.23` into the runtime image. No live import path today. | Move `shadcn` to `devDependencies`, regenerate lockfile, re-audit. | P2 |
| ISS-13 | **CI audit can't block a merge** — `continue-on-error: true` + `npm install --no-audit` (not `npm ci`) (`.github/workflows/ci.yml`). | Add a blocking `npm ci && npm audit --omit=dev --audit-level=high` step. | P2 |
| ISS-14 | **Schema-version gate uses `MAX(version)` only** — a skipped middle migration (e.g. mig 198 least-privilege REVOKEs) passes the health check while its hardening stays unapplied (`143_schema_version_sentinel.sql`, `health/route.ts`). | Make the sentinel detect gaps (gapless ceiling or set-membership). | P2 |
| ISS-15 | **`profiles.google_calendar_refresh_token` comment claims app-layer encryption but no wrapper exists** — always NULL today, but primes a future plaintext-token-at-rest bug. | Drop the dead column or correct the comment + add a `enc:`-prefix CHECK. | P3 |
| ISS-16 | **At-rest keys validated as 32 *chars* not 32 *bytes* of entropy**; backups fall back to v1 with a source-hardcoded salt when `*_SALT_V2` unset (`env.ts:52,60`, `secrets.ts:31`). A correctly-generated key is safe (GCM doesn't need salt secrecy); risk is a low-entropy passphrase. | Validate base64/hex → ≥32 random bytes; make v2 salt mandatory in prod; refuse to *write* new v1 backups. | P2 |
| ISS-17 | **Raw Google token-endpoint error body persisted into `office_integrations.last_error`** and surfaced to admin UI + deep health (`google-oauth.ts:130-133`). Both sinks are privileged; OAuth-diagnostic info, not a credential leak. | Store an enumerated reason code; log the raw body server-side only. | P3 |
| ISS-20 | **No consent/lawful-basis record for advisor-keyed or imported borrowers** — only the public `/check` path captures one (`152`, `save-borrower.ts`). | Persist a per-subject lawful-basis record on first store; backfill for the imported 80 cases. | P2 |
| ISS-22 | **Unbounded task creation/reassignment** → notification + push + email bomb against any colleague; `case_id=NULL` so the victim can't scope it away (`create-task.ts`, `reassign-task.ts`). | Add `checkRateLimit` to both, mirroring `add-task-comment.ts`. | P1→P2 |
| ISS-23 | **`upsert_case_financials` trusts caller-supplied `p_user_id`** for `created_by`/`updated_by` (attribution forgery) — same class mig 199 fixed for `set_primary_bank`, not applied here (`027`). | Add `IF auth.uid() <> p_user_id THEN RAISE … 42501` or drop the param. | P2 |
| ISS-25 | **`case_payouts` and `case_expenses` have no audit trigger** — fee-distribution/expense changes that feed statistics' net fee are unaudited (`186_case_payouts.sql`, `081_case_expenses.sql`). | Attach `audit_log_change` AFTER INSERT/UPDATE/DELETE triggers; add to mig-133 redaction list. | P2 |
| ISS-26 | **No audit record for auth/account-security events** (login, MFA disable, session revocation) — `audit_log` covers only `public.*` DML (`mfa-manage.ts`, `122_…`, `login.ts`). | Emit best-effort app-level audit rows for security events via the service-role writer. | P2 |
| ISS-31 | **Public-intake office-mirror email has no global ceiling** — XFF-spoofing direct-to-origin attacker can flood the office inbox + burn Resend quota (`create-intake-lead.ts`, `request-ip.ts`). Constrained to edge-bypass (Vultr origin). | Add a fail-closed global hourly ceiling on the office mirror; pin `getRequestIp` to a trusted-proxy header. | P2 |

---

## 6. Attack Surface Analysis

| Surface | Exposure | Posture |
|---|---|---|
| **Edge auth (`proxy.ts` + `updateSession`)** | All non-static routes | Strong: `getUser()` refresh, protected-route redirect, SEC-AUTH-1 deactivation gate. Documented prefetch skip (acceptable — next real request re-checks). Note: Server Functions POST to the page path, so the matcher exclusions must never host a page/action (documented). |
| **~115 Server Actions** | Authenticated | Consistently auth + Zod + `Result<T,E>` + `userCanEditCase` + generic errors. Gaps: missing rate limits on `createTask`/`reassignTask`/`postCaseComment`/`prepareEmailAttachment` (ISS-06/22/30); a few actions lean on RPC auth instead of explicit `getUser` (safe in practice). |
| **SECURITY DEFINER RPCs (118 files)** | `authenticated` (mostly) | Mostly hardened (mig 198/199 least-privilege + `search_path` pinning + actor assertions). Residual: global `national_id` dedup (ISS-02), `upsert_case_financials` actor forgery (ISS-23). |
| **Public/anon HTTP** | Internet | `/api/web-lead` + `/check` defended (CORS + honeypot + timing trap + fail-closed IP/email rate limits). Residual: office-mirror email has no global cap + XFF spoofable at origin (ISS-31). |
| **Cron routes** | `CRON_SECRET` bearer | Constant-time `timingSafeEqual`, fail-closed when unset, ≥32-char enforced. Single shared secret across 8 endpoints (accepted — see Appendix ISS-34). |
| **Storage buckets** | Mixed | `case-documents` private + per-case RLS + magic-byte sniff on upload. Gaps: `bank-logos` public + unvalidated (ISS-09); `case_docs_delete` uses view-not-edit predicate (ISS-10); Drive-import path skips sanitization (ISS-11). |
| **Web Push** | Authenticated | Blind SSRF via unvalidated endpoint (ISS-03, defanged by forced HTTPS). |

---

## 7. Data Exposure Analysis

- **Cross-case PII (national IDs, income, obligations):** exposed via **ISS-02 (High)** to any authenticated advisor who knows a national ID; via **ISS-01 (Medium)** to any `view_case_fee` holder for the fee/expected-income fields.
- **Manager-only financials (`fee_amount`, `expected_income`):** read+write cross-case under ISS-01; attribution-forgeable under ISS-23.
- **At-rest:** OAuth tokens + full backup snapshots encrypted AES-256-GCM with domain-separated keys (strong). Residual: key-entropy validation (ISS-16); a dead-but-mislabeled "encrypted" calendar column (ISS-15).
- **In-transit:** HTTPS + HSTS on Vercel client prod (good); plaintext HTTP on Vultr staging (ISS-07).
- **Error/log leakage:** systematically avoided in user-facing actions; one privileged-only residual (ISS-17).
- **Backup snapshot:** the two documented `select('*')` exceptions are intentional and redact credential columns (e.g. `google_calendar_refresh_token`).

---

## 8. Privilege Escalation Analysis

- **No vertical escalation to admin confirmed.** The candidate paths were refuted: restore-injection of privileged rows fails because triggers fire on the `authenticated` JWT claim even inside DEFINER (Appendix ISS-29); direct case deletion is default-denied (Appendix ISS-21); MFA-disable is moot (MFA dormant, Appendix ISS-32).
- **Horizontal (cross-case) escalation IS present:** ISS-02 (borrower PII), ISS-01 (fee data), ISS-04 (task-assignment grants durable case read), ISS-10 (blob deletion on view-only cases).
- **Attribution forgery (a lesser integrity escalation):** ISS-23 (`upsert_case_financials` trusts `p_user_id`).
- The configurable RBAC model is sound; the gaps are in *which predicate* specific tables enforce, not in the mechanism.

---

## 9. Multi-Tenant / Case Isolation Review

This is a single-tenant office (one Kaufman org), so "tenant" = "case/advisor scope." Isolation is enforced by `can_view_case`/`can_edit_case` propagated to every child table + storage RLS — a solid canonical design (migs 147/190/192/195/196). Confirmed isolation breaks:
- **ISS-02** — global `national_id` dedup pulls another advisor's borrower into your case.
- **ISS-01** — `case_financials` ignores case scope.
- **ISS-04** — assigning a task grants the assignee durable full-case read regardless of their role's case visibility.
- **ISS-10** — blob deletion permitted on merely-viewable (not editable) cases.

Recommendation: audit *every* per-case table to confirm it joins to `can_view_case`/`can_edit_case` (ISS-01 proves one slipped through the mig-039 sweep), and constrain task-assignment to assignees who already have case access.

---

## 10. Infrastructure Security Review

- **Vercel client prod:** HTTPS + HSTS + security headers (good). **Score driver:** the self-hosted Vultr path is weaker — plaintext HTTP (ISS-07), root container with no runtime hardening on a shared host (ISS-08), prod image carries a vulnerable `hono` (ISS-12).
- **CI/CD:** `verify` (tsc/lint/test via `npm ci`) is a real gate; the **audit** step is not (`continue-on-error`, `npm install`) — ISS-13.
- **Deploy gate:** `MAX(version)` schema check can miss a skipped middle migration (ISS-14) — relevant given the documented manual-apply + `SKIP_MIGRATIONS=1` workflow.
- **Secrets:** type-safe `env.ts`, required encryption keys with enforced domain-separation, no secrets in the repo. Good.

---

## 11. API Security Review

- **Server actions:** excellent baseline hygiene (auth/Zod/Result/generic errors).
- **Rate limiting:** present and fail-closed on expensive/abuse-prone actions (login, exports, PDF, import, lookup) — but **missing** on several fan-out vectors: `createTask`/`reassignTask` (ISS-22), `postCaseComment` (ISS-30), `prepareEmailAttachment` (ISS-06), and the intake office-mirror (ISS-31).
- **Enumeration:** `list_active_advisors()` / `list_case_mentionable_profiles` are authenticated-callable and expose colleague UUIDs (amplifies the fan-out bombs).
- **SSRF:** ISS-03 (Web Push endpoint), low due to forced HTTPS.
- **Error verbosity:** clean except ISS-17 (privileged-only).

---

## 12. File / Document Security Review

- **Uploads (in-app):** strong — `sanitizeFilename` (strips control/bidi/FS-reserved) + `fileTypeFromBuffer` magic-byte validation on every upload path, bucket-level `allowed_mime_types`/`file_size_limit` on `case-documents`.
- **Gaps:** `bank-logos` bucket is public + unvalidated + accepts SVG (ISS-09); the Drive-import path bypasses sanitization/sniffing (ISS-11, downstream sinks escape it); raw-blob DELETE uses the view-not-edit predicate (ISS-10).
- **Signed URLs:** 300s TTL, scoped reads — but **unaudited** (ISS-24).

---

## 13. Compliance Review (Israeli PPL / GDPR)

**Weakest domain (score 4/10).** Right-to-erasure is effectively absent:
- **ISS-19** — borrower national_id + PII persists indefinitely after the last case is purged (no erasure RPC, `deleted_at` never set).
- **ISS-18** — converted intake leads retain the full PII+consent payload forever.
- **ISS-20** — advisor-keyed and the ~80 imported borrowers have no lawful-basis/consent record.
- **ISS-24 / ISS-25 / ISS-26** — disclosure and financial-table changes and auth events are unauditable, undermining accountability/demonstrability requirements.

The public `/check` path *does* capture consent with policy version + timestamp + IP (good model to extend everywhere). Israeli PPL Amendment 13 (in force) raises the stakes on data-subject rights and recordkeeping — these should be on the near-term roadmap.

---

## 14. Incident Response Readiness

- **Strengths:** business-table audit triggers with IP/user-agent auto-capture (mig 047), audit-log immutability trigger + monthly partitioning, documented `INCIDENT_RESPONSE.md`, session-revocation RPC, deactivation gate.
- **Gaps:** **no audit trail for read/disclosure** (ISS-24) or **auth/account-security events** (ISS-26), and **two financial tables are unaudited** (ISS-25). An investigator cannot reconstruct *who exfiltrated which client's documents* or *when a session was force-revoked* from `audit_log` alone — they'd depend on Supabase's separate auth logs and Vercel function logs. Close ISS-24/25/26 to make the app's own trail forensically complete.

---

## 15. Security Technical Debt

1. **`case_financials` never got the mig-039 case-scope sweep** (ISS-01) — a known-pattern table slipped through; audit all per-case tables for the same omission.
2. **`upsert_case_financials` didn't get the mig-199 actor-assertion** (ISS-23) — the fix pattern exists, just unapplied.
3. **Two financial tables added after the audit wiring lack triggers** (ISS-25) — new tables should inherit audit by default.
4. **Dead/mislabeled column** (`google_calendar_refresh_token`, ISS-15) and **dependency misplacement** (`shadcn` in deps, ISS-12).
5. **Erasure machinery is partial** — soft-delete + purge exist for cases/leads but not for borrowers, and converted leads escape it (ISS-18/19).
6. Several items are already tracked in `RELEASE_REVIEW.md` (PRIV-erasure-borrower, PRIV-consent-notice) — close the loop.

---

## 16. Remediation Roadmap

### P0 — Before exposing the regulated-data product more widely (launch-blocking)
- **ISS-02** — gate the borrower `national_id` dedup on prior caller access in `create_case_draft`/`save_borrower_for_case_full`/`convert_lead_to_case`.
- **ISS-01** — add `can_view_case`/`can_edit_case` to `case_financials` RLS + the upsert RPC (one migration).

### P1 — Near-term (weeks)
- **ISS-30 / ISS-22** — add rate limits to `postCaseComment`, `createTask`, `reassignTask`.
- **ISS-24** — add read/disclosure audit logging to the 4 PII-export paths.
- **ISS-19 / ISS-18** — borrower erasure RPC + orphan sweeper; redact/minimize converted-lead payloads.
- **ISS-27** — independent, tamper-evident backup destination + key escrow.
- **ISS-07** — TLS-terminate the Vultr instance (or retire it from holding real PII).

### P2 — Hardening (this quarter)
- ISS-04, ISS-06, ISS-08, ISS-09, ISS-10, ISS-12, ISS-13, ISS-14, ISS-16, ISS-20, ISS-23, ISS-25, ISS-26, ISS-31, ISS-03.

### P3 — Cleanup / consistency
- ISS-05, ISS-11, ISS-15, ISS-17.

---

## Security Scores (0–10)

| Domain | Score | Notes |
|---|---|---|
| Authentication | **7** | Strong flows (rotation, magic-link, revocation, deactivation gate). MFA dormant/optional; ~1h JWT residual after revocation; XFF spoofable (per-email gate backstops). |
| Authorization | **5** | Sound RBAC mechanism, but ISS-02 (High) + ISS-01/04/10 cross-case gaps. |
| Data Protection | **5** | Good encryption-at-rest + transit on Vercel; dragged down by the cross-case PII exposures + key-entropy validation. |
| API Security | **6** | Excellent action hygiene; missing rate limits on fan-out vectors; blind SSRF. |
| Infrastructure | **5** | Vercel solid; Vultr plaintext HTTP + root container + vulnerable dep + non-blocking audit + max-only deploy gate. |
| Cloud | **6** | RLS-everywhere + service-role isolation good; public `bank-logos` bucket; deploy-gate gap. |
| Monitoring | **5** | Business-table audit good; no read/auth/financial-table audit (forensic blind spots). |
| Compliance | **4** | Right-to-erasure effectively absent; consent only on public intake. |
| Resilience | **5** | Backups share the live Drive token + single destination; no off-site/WORM; additive-only restore. |
| **Overall** | **6** | **SAFE WITH MAJOR RISKS.** |

---

## Final Verdict

# ⚠ SAFE WITH MAJOR RISKS — Overall 6/10

The Vercel/HTTPS client production instance is **deployable with compensating controls**, but for a product whose entire purpose is safeguarding regulated financial PII, **ISS-02 (High, cross-case borrower PII IDOR) and ISS-01 (Medium, cross-case `case_financials`) should be treated as launch-blocking**, and the right-to-erasure + forensic-audit + backup-resilience gaps need a committed near-term remediation plan. The engineering baseline is genuinely strong — the residual risk is narrow and fixable.

---

## Appendix — Refuted / By-Design (6)

These were reported by teams but **did not survive adversarial verification** — the prior hardening holds. Documented so you don't re-chase them.

| ID | Claim | Why it's refuted |
|---|---|---|
| **ISS-21** | Direct PostgREST `DELETE` on `cases` destroys any case + redacts audit | `022_security_hardening.sql:257` **drops** `cases_delete` (never recreated). RLS-enabled + zero DELETE policies = default-deny → direct DELETE affects **0 rows**. Dies at RLS. |
| **ISS-28** | Additive-merge restore (`ON CONFLICT DO NOTHING`) can't recover from tampering | Code claim is true and **intentional** (mig 058), but it's a DR feature gap, not an attacker-reachable vuln — no privilege boundary crossed. |
| **ISS-29** | DEFINER restore bypasses admin/profile integrity triggers → inject privileged rows | Premise wrong: restore uses the **cookie-bound `authenticated` client**, and `auth.role()` reads the JWT claim (inherited into DEFINER), so `guard_protected_profile` + `permissions_protection` triggers **fire**. Proven by the repo's own pgTAP test. |
| **ISS-32** | Stolen session can silently disable victim's TOTP (no step-up) | MFA is **dormant**: `MfaSection` is never rendered, `config.toml` sets TOTP `enroll/verify = false`. No verified factor can exist → nothing to disable. (Optional MFA is a real maturity gap, not this exploit.) |
| **ISS-33** | No session idle/absolute timeout | Evidence mislocated — `config.toml` is the **local-dev** CLI config; prod session timeout lives in the hosted Supabase dashboard, not this file. Posture unproven from the cited artifact. |
| **ISS-34** | Shared `CRON_SECRET` + unvalidated `/api/push/dispatch` payload | Real mechanics, but the whole path is gated by a constant-time `CRON_SECRET` bearer check with no attacker-reachable leak; anyone holding the secret already controls more dangerous endpoints with the same key. |

*Generated by a 73-agent adversarial security workflow (recon → 20 teams → triage → two-lens verification → scoring). Confirmed findings cite `file:line`; re-validate High/Medium against live Supabase project settings before remediation.*
