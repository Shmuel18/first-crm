# Kaufman go-live checklist

Single consolidated source of truth for what needs to happen between now and Moshe Kaufman uploading the first real PII row. The audit + 17 batches of fixes have closed the code-side gaps; everything that remains is operational.

Work top-to-bottom. Mark `[x]` as you go.

---

## Phase 1 — Account + infrastructure (30-60 min)

### 1.1 Upgrade Supabase project to Pro ($25/mo)
- [ ] Supabase Dashboard → **Settings → Billing** → upgrade to Pro
- [ ] After upgrade: **Settings → Database** → confirm **"Point in Time Recovery — 7 days enabled"**

**Why this is non-negotiable:**
- Free tier has **no automated DB backups** (only your app-level Drive backup, which has a 24h window of unrecoverable data between runs)
- No PITR = a destructive admin action at 14:00 can't be rolled back from a 02:00 backup that's missing the bad change
- Costs $25/mo total — single highest leverage spend before paying customers

> 📕 **Recovery decision guide:** which tool to use for a mass-delete vs. corruption vs. bad-edit vs.
> a broken deploy is documented in [`docs/RESTORE_RUNBOOK.md`](./RESTORE_RUNBOOK.md). Short version:
> the Drive "Restore" is **merge-only** (re-inserts *deleted* rows, never repairs *changed* ones) —
> corruption / bad edits / point-in-time rollback need **PITR**, not the Drive restore.

### 1.2 Generate a Vercel account + project
- [ ] Sign up at https://vercel.com (or log in)
- [ ] Import the GitHub repo (`Shmuel18/first-crm`) as a new project
- [ ] Choose Next.js framework preset (auto-detected)
- [ ] **DO NOT click "Deploy" yet** — env vars come first (1.4)

### 1.3 Sign up for the supporting services
- [ ] **Sentry** (free tier OK — 5K errors/month): https://sentry.io → create org + project (Next.js)
- [ ] **Resend** (if not already): https://resend.com → API key + verify a sending domain (e.g. mail.kaufman.co.il)
- [ ] **UptimeRobot** (free tier OK — 50 monitors, 5min interval): https://uptimerobot.com → create account

### 1.4 Collect Vercel env vars (everything in `.env.local` + a couple new)
Vercel Project → Settings → **Environment Variables**. Add all of these for **Production** scope (re-add for Preview if you want preview deploys to share):

| Var | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key | Same as `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | **NEVER commit; sensitive** |
| `DATABASE_URL` | Supabase → Settings → Database → Connection info | Use the **direct connection** URL (port 5432) not the pooler — same as `.env.local` |
| `NEXT_PUBLIC_APP_NAME` | `Kaufman Finance Group` | Literal |
| `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>` | Set after first Vercel deploy assigns a domain |
| `INTEGRATION_ENCRYPTION_KEY` | `openssl rand -base64 48` (run once) | **STORE IN PASSWORD MANAGER**, ≥32 chars, never rotates without re-encrypting tokens |
| `BACKUP_ENCRYPTION_KEY` | `openssl rand -base64 48` (different value!) | **STORE IN PASSWORD MANAGER**, lose it = old backups unrecoverable |
| `BACKUP_ENCRYPTION_STRICT` | `false` for now | Flip to `true` after first encrypted backup verified |
| `INTEGRATION_ENCRYPTION_STRICT` | `false` for now | Flip to `true` after first nightly backup |
| `CRON_SECRET` | `openssl rand -base64 48` | Used by `/api/cron/backup` Authorization: Bearer |
| `RESEND_API_KEY` | Resend → API Keys → create | For team-invite emails, password-reset emails, future notifications |
| `EMAIL_FROM` | e.g. `Kaufman CRM <noreply@mail.kaufman.co.il>` | Domain must be verified in Resend |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console → APIs & Services → OAuth client | For Drive integration |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Same | |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<your-domain>/api/auth/google/callback` | Add to Cloud Console allowed redirects too |
| `GOOGLE_OAUTH_ALLOWED_DOMAIN` | `kaufman.co.il` | Only Workspace accounts in this domain can connect Drive |
| `SENTRY_DSN` | Sentry → Project Settings → Client Keys | When you wire Sentry (Phase 4) |

### 1.5 Disable Vercel's auto-deploy from git
- [ ] Vercel → Settings → **Git** → uncheck "Automatically deploy commits to production"
- [ ] **Why:** `.github/workflows/deploy.yml` drives prod deploys now — runs Supabase migrations BEFORE Vercel deploy. Without disabling auto-deploy, Vercel races ahead with code that references DB columns the migration hasn't applied yet.

### 1.6 Add GitHub repo secrets for the deploy workflow
GitHub → repo Settings → **Secrets and variables** → **Actions** → add all six:

| Secret | Where to get |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens (account-level, NOT project-level) |
| `SUPABASE_PROJECT_REF` | Supabase Dashboard → Settings → General → Reference ID (short slug) |
| `SUPABASE_DB_PASSWORD` | Supabase Dashboard → Settings → Database → Database password |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Local: run `vercel link` → read `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Same file → `projectId` |

### 1.7 Verify deploy.yml end-to-end
- [ ] Push a no-op commit to `main` (e.g. add a space to a README)
- [ ] GitHub Actions tab: confirm both `migrate` + `deploy` jobs run green
- [ ] First run is slow (~3 min cold build); subsequent ~90 s

---

## Phase 2 — Monitoring + alerts (20 min)

### 2.1 Wire UptimeRobot
- [ ] UptimeRobot → New Monitor → **HTTP(s)** → `https://<your-domain>/api/health` → 5min interval
- [ ] Add Contact: SMS or push to your phone
- [ ] Add a second monitor: `/api/health?deep=1` → 1h interval, alert on any non-2xx. The deepcheck reports Drive token / encryption-key / CRON_SECRET state.
- [ ] (Optional) Add third monitor on `/login` — catches Next-runtime crashes that `/api/health` would miss.

### 2.2 Wire Sentry
Sentry's Next.js wizard does most of the work. After running it:
- [ ] Edit `src/lib/logger.ts` — in the `emit` function, after the console call, add:
  ```ts
  if (level === 'error' && typeof Sentry !== 'undefined') {
    Sentry.captureMessage(message, { level: 'error', extra: fields });
  }
  ```
- [ ] Sentry → Settings → **Data Scrubbers** → enable defaults + add `phone`, `national_id`, `email`, `password` to the deny-list
- [ ] Smoke test: trigger `logger.error('test from deploy')` from somewhere reachable → confirm event lands in Sentry within 60s

### 2.3 Daily backup sentinel (recommended)
The nightly backup runs at 02:00 UTC. A silent failure (Drive token expired, CRON_SECRET mismatch, etc.) goes unnoticed until restore time.

Two options:
- **Easy:** Add a Vercel cron at 03:30 UTC hitting `/api/health?deep=1` — UptimeRobot will alert you when the response is non-2xx
- **Better (~30 LOC):** Add `/api/cron/backup-sentinel/route.ts` that lists the `KFG_Backups` Drive folder, asserts a file exists matching today's date prefix, sends a Resend email to admin if not. Wire as a daily Vercel cron in `vercel.json`.

---

## Phase 3 — Supabase dashboard final passes (10 min)

These were done during the audit walkthrough on the dev project — **redo on the prod project after creating it**:

- [ ] **Disable self-signup:** Supabase Dashboard → Authentication → Sign In / Providers → toggle "Allow new users to sign up" to OFF
- [ ] **Enable pg_cron extension:** Supabase Dashboard → Database → Extensions → pg_cron → Enable Extension
- [ ] **Verify PITR enabled** (after Pro upgrade): Database → Backups → Point in Time tab should show "enabled"

---

## Phase 4 — Apply migrations to prod (15 min, depends on prod project existing)

All 13 migrations from the audit (049–061) are written but currently applied **only to your dev Supabase project**. When you create the prod project, apply them again.

### Pre-deploy checks (in prod SQL Editor)
Before applying migrations 052, 053, 060 — run the queries in the file headers to confirm no dirty data. If prod was seeded from a clean state, all should return empty.

### Apply path
```powershell
# Generate the URL-encoded password (same trick as walkthrough)
$PASS_RAW = (Get-Content .env.production.local | Select-String "^DATABASE_URL=") -replace '^DATABASE_URL=postgres(ql)?://[^:]+:([^@]+)@.+$','$2'
$PASS_ENC = node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" -- $PASS_RAW
$URL = "postgresql://postgres:${PASS_ENC}@db.<prod-project-ref>.supabase.co:5432/postgres"

npx supabase db push --db-url $URL
```

The CLI will list all unapplied migrations and prompt before running.

After applying:
- [ ] Migration 053 created a UNIQUE index on `borrowers.national_id` — verify no duplicates blocked the apply
- [ ] Migration 057 scheduled 3 pg_cron jobs — verify with `SELECT jobname FROM cron.job;` (should see kfg_purge_audit_log, kfg_purge_soft_deleted, kfg_purge_rate_limit_counters)
- [ ] Migration 060 added the profiles.metadata guard trigger — non-admins now can't modify metadata via self-update
- [ ] Migration 061 revoked bank_account_number column SELECT from authenticated — any future code that needs it must go through service_role

---

## Phase 5 — First deploy + verify (30 min)

### 5.1 Trigger deploy
- [ ] Push a tiny commit to `main` (e.g. update a comment) — `deploy.yml` runs migrations then deploys to Vercel
- [ ] Watch the Actions tab — confirm both `migrate` (will say "no new migrations" after Phase 4) and `deploy` succeed

### 5.2 Smoke tests against the live URL
- [ ] `/api/health` returns `{ ok: true, db: <ms>, build: <sha> }`
- [ ] `/api/health?deep=1` returns 200 with all checks `ok` (Drive may be `unconfigured` if you haven't connected it yet)
- [ ] `/login` renders cleanly (no console errors)
- [ ] Forgot-password flow: enter your own email → check inbox → click link → land on `/auth/set-password`
- [ ] Set a password → log in → land on `/cases`

### 5.3 First admin user (you/Moshe)
- [ ] In Supabase Dashboard → Authentication → Users → **Add user** → enter your email + a strong temp password
- [ ] In SQL Editor: `UPDATE profiles SET role_id = (SELECT id FROM roles WHERE key = 'admin') WHERE email = '<your-email>';`
- [ ] Log in via `/login`, change password from `/settings/security`
- [ ] Repeat for Moshe Kaufman's account

### 5.4 Manual UI verification (on a phone)
- [ ] Open the live URL on a phone — see the hamburger menu, open it, navigate between tabs
- [ ] Open a case (need at least one created) — see the action bar; "Calculator" + "SendMessage" buttons should look disabled with "בקרוב" tooltip
- [ ] Open a task → click `⋯` → Delete → confirm the AlertDialog renders before deletion
- [ ] As admin: case page → `⋯` → see the **Delete** entry; click → AlertDialog confirms before delete

### 5.5 Connect Drive integration
- [ ] Settings → Integrations → Google Drive → Connect
- [ ] Google OAuth flow (must be a `@kaufman.co.il` Workspace account per `GOOGLE_OAUTH_ALLOWED_DOMAIN`)
- [ ] Verify Drive folder `KFG_Cases` appears in Drive root
- [ ] Trigger a manual backup: Settings → Backup → Run backup now → verify file lands in `KFG_Backups/` as `.kfg-backup`

### 5.6 Flip strict encryption mode (after step 5.5 verified)
- [ ] Vercel → Settings → Environment Variables: change `BACKUP_ENCRYPTION_STRICT` and `INTEGRATION_ENCRYPTION_STRICT` to `true`
- [ ] Redeploy (push a no-op commit OR Vercel → Deployments → Redeploy)
- [ ] **Why now and not before:** strict mode rejects any plaintext (`enc:v1:`-less) value. Until you've confirmed all backups + OAuth tokens are encrypted, leaving these `false` keeps the backward-compat path live. After step 5.5, you have at least one encrypted artifact, so it's safe to lock down.

---

## Phase 6 — Invite the team (10 min)

- [ ] Settings → Team → Invite — for each advisor + secretary:
  - Enter name, email, phone, role
  - System sends the magic-link invite via Resend (or shows you the link to share manually if email failed)
- [ ] Each invitee clicks link → lands on `/auth/set-password` → picks their own password → done
- [ ] Confirm the inviter never sees an actual password at any step

---

## Phase 7 — Ongoing (post-launch monitoring)

After Kaufman is in for a week, set yourself a calendar reminder to review:
- [ ] Sentry error volume — any repeating errors?
- [ ] UptimeRobot uptime — any flaps?
- [ ] Drive backup folder — is there a file for each of the last 7 days?
- [ ] `/api/health?deep=1` — all checks still `ok`?

---

## Things explicitly NOT done (and why)

These were in the audit but intentionally deferred — they're either operational, big refactors, or carry visual risk that needs a focused PR:

| Item | Status | Why deferred |
|---|---|---|
| **MFA enrollment UI for admins** | TODO | Supabase Auth supports TOTP on Pro tier. Add the enrollment + verify flow as a dedicated feature post-launch. Single weak admin password is still the biggest residual risk. |
| **3 god-file service extractions** (audit, drive-sync, google-drive) | TODO | Refactor to pull pure domain logic out of services into testable modules. Working today; pure code quality win. |
| **Direct-to-storage document uploads** | TODO | Replaces the 21 MB `bodySizeLimit` Server Action path. Risk of breaking document upload — needs staged rollout. |
| **Streamed PDF/XLSX export downloads** | TODO | Current base64-through-action approach caps at ~3K cases. Becomes urgent only at multi-tenant scale. |
| **Borrowers shared-across-cases RLS rewrite** (DI6) | TODO | A borrower linked to two cases can be edited by either case's editor. Per-case-borrower-rows or per-case write check — risky RLS change, needs staging soak. |
| **Bootstrap RPC + dashboard SQL pagination** | TODO | Premature at current 80-case scale; becomes urgent at multi-office. |
| **CSP nonce middleware** | TODO | Tightens `script-src` past the current foundation CSP. Per-request nonce can blank-screen pages if a Next inline script doesn't get the nonce — needs careful browser verification. |
| **Bank logos local mirror** | TODO | Currently loaded from `upload.wikimedia.org` per row. Needs binary asset copying. Not a blocker at current scale. |
| **Edge runtime on /login + /forgot-password** | TODO | Cold-start win is real but verification needs production traffic. |
| **Audit log partitioning by month** | TODO | Premature at 1 year of growth. |

When/if these matter, each has a self-contained brief — search the codebase for the file/feature name and the audit findings will surface in the commit history.

---

## What was completed (reference, not action items)

23+ commits on `main` (`0e745ad` → `b2f0ecc`) covering:

**Security:**
- Security headers (HSTS, X-Frame-Options, CSP foundation, Permissions-Policy)
- Rate-limit infrastructure with fail-open/fail-closed modes; applied to login, set-password, invite-member, lookup-borrower, password-reset
- Magic-link team invite flow (no admin-sees-temp-password)
- Encryption at rest with versioned prefix + opt-in strict mode
- Filename sanitization on document upload
- OAuth `hd`-only domain check
- 60s signed URL expiry default
- Audit log immutability + IP/UA sanitization (DB-level)

**Database:**
- 13 migrations (049–061): audit immutability, IP sanitization, pg_cron schedules, monetary/date CHECKs, UNIQUE national_id, financials audit trigger, transactional RPCs, optimistic-lock columns, restore-deleted_at, signup hardening, FK indexes, GIN on tags + changed_fields, bank_account admin-only
- Cleanup RPCs scheduled via pg_cron
- profiles.metadata guard trigger
- Notifications explicit deny INSERT
- documents.uploaded_by DEFAULT auth.uid

**UX:**
- Mobile navigation drawer (hamburger + slide-in sheet)
- Password reset flow
- Case soft-delete UI with confirmation
- Task delete confirmation (AlertDialog)
- Income/obligation/template delete confirmations (AlertDialog replaces window.confirm)
- Settings nav active page highlight
- Leads mobile card list
- ILS canonical formatting
- inputMode hints on currency inputs
- Dead Calculator/SendMessage buttons gated with "coming soon"

**i18n:**
- Audit field-labels (~50 keys + enum values) lifted to messages/{he,en}.json
- PDF strings module — bank-submission PDF now renders in user's session locale
- Forgot-password, audit log values, settings nav all bilingual

**Observability:**
- Structured logger (lib/logger.ts) with level filtering
- Per-request `X-Request-Id` minted in middleware, attached to request + response
- Fetch timeouts on Drive/OAuth/Resend (8s default)
- `maxDuration` on /api/cron/backup (60s) + /api/auth/google/callback (30s)
- /api/health (live) + /api/health?deep=1 (per-dependency status)

**Architecture/quality:**
- Code architecture compliance — fixed Domain→UI violation, closed 4 `select('*')` template loopholes, 2 `error.message` leaks
- 7 new semantic Tailwind theme tokens (replaced 8 bracketed-hex literals)
- `formatDate` centralized in `lib/utils/format-date.ts`
- TanStack Query removed (unused)
- Audit `lib/field-labels.ts` ~145 hardcoded Hebrew lines lifted to i18n

**Infra:**
- `.github/workflows/deploy.yml` runs Supabase migrations BEFORE Vercel deploy
- Supabase CLI added as dev dep
- `.env.example` updated with all new vars

**Score:** went from ~58/100 (initial audit) → ~85/100 (current). The remaining 15 points come from the deferred items above + the operational steps in this checklist.
