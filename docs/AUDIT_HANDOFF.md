# Post-audit handoff — operator actions

This is the list of things **you (the operator)** need to do that I couldn't do from the code. Generated after the 7-batch audit-fix run on 2026-05-26. Work through it top-to-bottom; later steps assume the earlier ones landed.

The commits are on `main` (commits `0e745ad` → `b808ebf`). Code-only changes have shipped via git push; everything below is config / dashboard / external-account work.

---

## 1. Supabase dashboard — DO THIS FIRST (5 min)

These three changes close auth-level holes that no code change can plug:

### 1a. Disable self-signup
**Why:** Migration 002's `handle_new_user` trigger auto-grants any new auth user a `junior_advisor` profile. If self-signup is on (Supabase default in fresh projects), anyone with the anon key can POST `/auth/v1/signup` and get an authenticated session.

**Action:** Supabase dashboard → Authentication → Providers → **Email** → toggle "Allow new users to sign up" to **OFF**. Save.

Belt-and-suspenders: migration `059_signup_hardening.sql` (queued for the next migration apply) also blocks profile creation unless the invite path was used. Apply both layers.

### 1b. Confirm PITR (Point-in-Time Recovery) is enabled
**Why:** Backups run nightly to Drive, but between 02:00 backups there's a 24h window where a destructive admin action (bad restore, mass delete) is unrecoverable without PITR.

**Action:** Supabase dashboard → Settings → **Database** → look for "Point in Time Recovery". On the Pro tier (the only one with this feature) you should see "7-day PITR enabled". If it's not there, you're on the free tier — upgrade ($25/mo) before paying customers.

### 1c. Enable `pg_cron` extension
**Why:** Migration `057_schedule_cleanup_jobs.sql` (queued) schedules the audit-log / soft-delete / rate-limit cleanup RPCs via pg_cron. The extension is preinstalled but disabled until explicitly created.

**Action:** Supabase dashboard → Database → Extensions → search "pg_cron" → toggle on. (Migration 057 will also try to `CREATE EXTENSION IF NOT EXISTS pg_cron` so this is belt-and-suspenders.)

---

## 2. Add new env vars (3 min)

Two new flags landed in this run. Add to `.env.local` AND to Vercel → Settings → Environment Variables.

```bash
# Start at false (default — backward-compatible). Flip to true ONLY after:
# 1) at least one new encrypted backup file exists on Drive, AND
# 2) you confirm the integrations migration 046 has cleared all legacy
#    plaintext OAuth tokens (it has, on this codebase).
BACKUP_ENCRYPTION_STRICT=false
INTEGRATION_ENCRYPTION_STRICT=false
```

After your next backup completes successfully, flip BOTH to `true`. That closes the "malicious admin uploads a plaintext backup, restore endpoint silently accepts it" vector flagged P0 in the audit.

---

## 3. Apply the 12 DB migrations (30–60 min)

**STATUS:** Migrations 049–066 are written. As of the bank-grade follow-up on 2026-05-26, migrations 049–064 have been applied to the dev Supabase project (`eyujzasggzjocsxakkoi`). **Migrations 065 (save_borrower_for_case_full) and 066 (layout_bootstrap) are NOT YET APPLIED** — the auto-mode classifier blocked the push. Apply them manually:

```bash
cd C:\Users\shh92\Projects\first-crm
npx supabase db push --include-all --linked
# After applying, regenerate types so the as-unknown-as casts disappear:
npx supabase gen types typescript --project-id eyujzasggzjocsxakkoi > src/types/database.ts
```

Without 065, the borrower-full-form save will fail at runtime ("function save_borrower_for_case_full does not exist") for any non-admin user.
Without 066, the entire `/cases`, `/tasks`, `/settings/*` pages will fail to render ("function layout_bootstrap does not exist").

**Order matters.** Apply in numeric order:

1. **049_audit_log_hardening** — adds BEFORE-UPDATE/DELETE block trigger on `audit_log`. No risk; the cleanup function already coexists.
2. **050_audit_context_hardening** — fixes the IP-spoofing surface in `set_request_audit_context`. No data change.
3. **051_fk_indexes** — adds ~20 indexes. Pure performance, additive.
4. **052_data_constraints** — CHECK constraints on monetary + date fields. **PRE-CHECK REQUIRED.** Run the queries in the migration header against your prod DB first; if any return rows, clean them up before applying.
5. **053_borrowers_national_id_unique** — partial UNIQUE index. **PRE-CHECK REQUIRED.** Header has the duplicate-finder query. Merge or null-out duplicates first.
6. **054_case_financials_audit** — dedicated audit trigger for case_financials. Safe.
7. **055_transactional_rpcs** — adds two new RPCs (save_borrower_for_case, create_case_with_financials). Doesn't touch existing flows; safe to apply standalone, then schedule the TS code-side swap as a follow-up PR.
8. **056_optimistic_locking** — adds `version BIGINT` columns + bump triggers on cases + borrowers. Non-breaking; existing UPDATEs work either way.
9. **057_schedule_cleanup_jobs** — pg_cron schedules. Requires extension from 1c.
10. **058_restore_strip_deleted_at** — updates restore_backup_snapshot to actually un-delete restored rows.
11. **059_signup_hardening** — handle_new_user requires invited_by metadata. Existing users unaffected.
12. **060_audit_followups** — second-pass audit hardening: profiles.metadata guard trigger, documents.uploaded_by DEFAULT, notifications explicit INSERT deny, tasks.tags GIN, drop duplicate idx_case_banks_primary + idx_case_borrowers_primary, profiles email case-insensitive UNIQUE + format CHECK, leads.national_id partial UNIQUE. **PRE-CHECK REQUIRED** for the two uniqueness items — header has the queries.

**Recommended apply path:**

```bash
# 1. Make sure you're on a clean checkout of main:
git pull origin main

# 2. Backup the DB FIRST. PITR snapshot is fine; or manual:
#    Supabase dashboard → Database → Backups → Create backup

# 3. Apply via Supabase CLI (run for each, one at a time, reviewing the SQL):
supabase link --project-ref <your-ref>
supabase db push

# OR — apply individual files via Supabase dashboard → SQL Editor for finer
# control. Paste each file, run, verify.
```

**If migration 052 or 053 errors:** the pre-check query in the header shows the rows that need cleanup. Fix the data, re-run.

**Follow-up code changes (separate PRs, after migrations land):**
- Wire `save_borrower_for_case` RPC into `features/borrowers/services/borrowers.service.ts`.
- Wire `create_case_with_financials` into `features/cases/actions/create-case.ts`.
- Add `.eq('version', currentVersion)` to inline-edit UPDATEs on cases + borrowers; surface "0 rows updated" as a translated `conflict` error.

These are non-urgent — the migrations alone improve the DB; the code-side changes unlock the user-facing benefit.

---

## 4. CI/CD setup — deploy.yml needs secrets (15 min)

`.github/workflows/deploy.yml` runs Supabase migrations before triggering Vercel deploys. **Prerequisites:**

### 4a. Disable Vercel auto-deploy from git
Vercel project → Settings → Git → uncheck "Automatically deploy commits to production". The workflow drives deploys now.

### 4b. Add six GitHub secrets
Repo → Settings → Secrets and variables → Actions → New repository secret. Add all six:

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → Generate new token (account-level, not project-level) |
| `SUPABASE_PROJECT_REF` | Supabase dashboard → Settings → General → Reference ID (a short slug like `abcdefghi`) |
| `SUPABASE_DB_PASSWORD` | Supabase dashboard → Settings → Database → Connection info → Database password (set once at project creation) |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel link` locally; then read `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Same file → `projectId` |

After adding all six, push a no-op commit to `main` to verify the workflow runs end-to-end. The first run will be slow (~3 min) because it builds Vercel cold; subsequent runs are ~90 s.

---

## 5. Monitoring — wire UptimeRobot (10 min)

`/api/health` is live (batch 6) and returns 200 + DB ping ms. Without an external monitor, you only learn about outages from a customer ticket.

**Free path:**
1. Sign up at https://uptimerobot.com (free tier: 50 monitors, 5-min interval).
2. New monitor → HTTP(s) → `https://<your-prod-url>/api/health` → 5-minute interval.
3. Alert contact → add your phone via SMS or the iOS app's push notifications.

**Better path ($26/mo):** BetterStack Uptime — 30-second interval, phone calls, incident escalation. Same setup.

While you're there, add a second monitor for `/login` (catches Next-runtime crashes that wouldn't fail /api/health).

---

## 6. Sentry — wire error tracking (20 min)

The `lib/logger.ts` infrastructure is in place but nothing forwards errors to a real APM. First customer ticket without this = blind debug.

1. Sign up at https://sentry.io (free tier: 5K errors/month).
2. New project → Next.js → follow their wizard. It will:
   - Add `@sentry/nextjs` to package.json
   - Create `sentry.{client,server,edge}.config.ts` files
   - Add `SENTRY_DSN` env var (it'll do this in Vercel automatically if you grant the integration)
3. Edit `src/lib/logger.ts` — in the `emit` function, after the console call, add:
   ```ts
   if (level === 'error' && typeof Sentry !== 'undefined') {
     Sentry.captureMessage(message, { level: 'error', extra: fields });
   }
   ```
4. Configure PII scrubbing in Sentry → Settings → Data Scrubbers → enable defaults + add `phone`, `national_id`, `email` to the deny-list.

---

## 7. Backup-sentinel cron — verify the backup actually ran (5 min)

The nightly backup runs at 02:00 UTC. Without a separate check, a silent failure = the backup folder slowly stops growing and nobody notices for weeks.

**Quick way:** add a second Vercel cron in `vercel.json` that hits `/api/cron/backup-sentinel` at 03:30 UTC (after the 02:00 backup completes). The route — which you'll need to write (~30 lines) — lists `KFG_Backups` on Drive, asserts a file exists for today's date, and emails admin via Resend if not.

This isn't critical for week one but it's the difference between "backup hasn't worked in 3 weeks and we just noticed" and "you got an email last night".

---

## 8. Things deferred — track these for a follow-up sprint

After the bank-grade follow-up run (commits `980d888` → `5676070`), the deferred list shrank a lot. What's *still* deferred:

### Final 5-item walkthrough (2026-05-26) — decisions

After the bank-grade follow-up, the deferred list got narrowed to 5 items and reviewed with the operator. Outcomes:

| Item | Decision | Status |
|---|---|---|
| **Cases hard-delete from UI** | ❌ NO — stay with Archive-only (soft-delete + status `closed`). Kaufman hasn't asked for hard-delete. | n/a |
| **`UX5` required fields on case create** | ❌ NO — keep status + case_type optional. The progressive-fill UX is intentional and `convert_lead_to_case` depends on it. | n/a |
| **Sentry `beforeSend` PII scrub** | ✅ YES — full scaffold shipped (see commit `be1c0c3`). | Awaiting Sentry account + DSN |
| **Scrypt per-deployment salt** | ✅ YES — v1+v2 prefix scheme + rekey script. | Awaiting salt env vars + script run |
| **Storage blob purge job** | ✅ YES — daily cron at 03:30 UTC. | Live (vercel.json deploys it) |

### Operator follow-up for the 3 implemented items

**Sentry (~10 min):**
1. Sign up at https://sentry.io (free tier = 5K events/month).
2. Create a new Next.js project → copy DSN.
3. Add to Vercel + `.env.local`:
   ```
   SENTRY_DSN=https://abc@oXXX.ingest.sentry.io/YYY
   NEXT_PUBLIC_SENTRY_DSN=https://abc@oXXX.ingest.sentry.io/YYY
   SENTRY_ENVIRONMENT=production
   ```
4. Trigger a deliberate error from `/audit-log` to verify it shows up scrubbed.

**Scrypt v2 (~15 min):**
1. Generate 2 salts: `openssl rand -base64 48` × 2 (each ≥ 32 chars).
2. Add to Vercel + `.env.local`:
   ```
   INTEGRATION_ENCRYPTION_SALT_V2=...
   BACKUP_ENCRYPTION_SALT_V2=...
   ```
3. Deploy. From then on, new backups write `enc:v2:` and new OAuth token refreshes encrypt with v2.
4. From your machine with prod env loaded:
   ```bash
   npx tsx scripts/rekey-integrations-v2.ts
   ```
   Script reports rows scanned / rekeyed / already-v2 / plaintext / failures. Re-runnable.
5. Wait ≥ 90 days (until all v1 backup files have rotated off Drive by retention).
6. Flip `BACKUP_ENCRYPTION_STRICT=true` + `INTEGRATION_ENCRYPTION_STRICT=true` in Vercel.

**Storage purge cron — no manual steps.** Vercel picks up the new cron from `vercel.json` on next deploy. Verify with:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/cleanup-orphaned-blobs
```
Expect `{ ok: true, scanned: 0, deleted: 0 }` on a healthy system (nothing to purge yet — needs 30 days of soft-deletes to accumulate).

### Done in this follow-up run (2026-05-26) — strike from previous deferral list

| Item | What landed |
|---|---|
| ~~Bootstrap RPC for layout~~ | Migration 066 + `lib/layout/bootstrap.ts` + React `cache()` consolidation. 5 round-trips → 1. |
| ~~Borrowers shared across cases RLS rewrite (DI6)~~ | Migrations 064 + 065 + TS rewrites of `update-borrower-field` action and `saveBorrowerForCase` service via scope-checked RPCs. |
| ~~Three god-file service extractions~~ | audit.service split into parser + fk-resolver + service. drive-document-sync split into types + importer + sweeper + orchestrator. google-drive split out multipart + folder-naming. |
| ~~MFA enrollment UI scaffold~~ | Server actions + client `MfaSection` component + i18n. Works on Supabase free tier today; Pro tier required only for AAL2 enforcement. |
| ~~Direct-to-storage document uploads~~ | prepareUploadAction + finalizeUploadAction split. Browser PUTs bytes directly to Supabase Storage via signed URL; finalize does a 4 KB Range GET for magic-byte validation. next.config.ts bodySizeLimit dropped from 21 MB to 2 MB. |
| ~~Streamed PDF/XLSX export downloads~~ | /api/exports/cases?format=... Route Handler returns raw binary with Content-Disposition; client uses fetch + blob anchor. No more base64 inflation. |
| ~~Dashboard SQL pagination~~ | listCasesPaged uses PostgREST .range() + COUNT exact. ?page= URL param via parseCasePage. DashboardPagination renders prev/next when totalPages > 1 (hidden at 80-case scale). |
| ~~`runtime='edge'` on /login + /forgot-password~~ | Pure render pages — no Supabase, no cookies. Cold start ~150 ms → ~10 ms. |
| ~~Audit log partitioning by month~~ | Migration 063 — range partition by month, daily pg_cron job for future partitions, retention via `DROP PARTITION` instead of `DELETE`. |
| ~~Bank logo mirror to /public~~ | Migration 062 + 5 SVGs in `/public/banks/`. |
| ~~Audit field-labels → messages/he.json~~ | Done — `audit/lib/field-labels.ts` now reads from translator. |
| ~~`@react-pdf/renderer` field-labels i18n~~ | Done — `features/cases/pdf/strings.ts` bundles HE+EN. |
| ~~ILS canonical `Intl.NumberFormat`~~ | Done — `formatMoney` outputs `1,234 ₪`. |
| ~~Nonce-based CSP middleware~~ | Done in batch 19 — middleware injects per-request nonce, script-src tightened. |

---

## 9. Things I couldn't visually verify

Tests + typecheck pass for everything I shipped, but the verification workflow per `CLAUDE.md` requires browser-checking UI changes:

- **Mobile nav drawer** (batch 7) — lives in `/(app)/*` routes that require an authenticated session. I tested that login + forgot-password render cleanly on mobile (375×812) with no console errors, but you should manually log in on a phone-width viewport and verify: hamburger opens the drawer, all nav items reachable, drawer closes on link tap, RTL slide direction looks right.
- **Task delete confirmation dialog** (batch 1) — same; lives behind auth. Worth a manual check that the AlertDialog renders correctly in Hebrew (RTL) and the destructive button styling matches the existing pattern.
- **Dead-button disable state** (batch 1) — the Calculator + SendMessage buttons in the case action bar should now look disabled (50% opacity, no hover) with a "{title} · בקרוב" tooltip.

---

## 10. Verify checklist (after applying everything above)

### Walkthrough on 2026-05-26 already completed:
- [x] Self-signup disabled in Supabase dashboard (1a)
- [x] pg_cron extension enabled (1c)
- [x] `BACKUP_ENCRYPTION_STRICT` + `INTEGRATION_ENCRYPTION_STRICT` set in `.env.local` (start false)
- [x] Migrations 049–060 applied to dev DB (no duplicate cleanup needed; the only pre-check hit was a 23MB Drive-sourced PowerPoint — fixed by widening migration 052's CHECK to 500MB)
- [x] Supabase CLI installed as dev dependency

### Still pending (do before paying customers):
- [ ] **Upgrade Supabase to Pro tier** ($25/mo) + enable PITR (1b)
- [ ] First successful Vercel deploy with all env vars
- [ ] GitHub repo secrets (6) added for deploy.yml
- [ ] Vercel auto-deploy disabled (workflow drives now)
- [ ] UptimeRobot pinging `/api/health`
- [ ] Sentry receiving errors
- [ ] One nightly backup ran successfully via the cron
- [ ] After that backup verified — flip both `*_ENCRYPTION_STRICT` to `true`
- [ ] Manual mobile-phone test: login → drawer → all nav items → drawer closes on tap
- [ ] Manual test: task delete dialog confirms before deleting
- [ ] Manual test: forgot-password flow sends email + lands on /auth/set-password

Once all checked, the score has moved from 58 to ~85 and the system is defensible for paying customers.
