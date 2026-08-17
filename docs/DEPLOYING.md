# Deploying first-crm

There are **two** running environments. They deploy differently, they point at
different databases, and confusing them is the classic mistake this document
exists to prevent.

| | Client production | Staging / demo |
|---|---|---|
| URL | `crm.kaufman-finance.com` | `http://104.207.131.136:3747` |
| Host | **Vercel** — project `kaufman-finance/kaufman-finance-prod` (region `fra1`) | Docker container `first-crm` on the Vultr host |
| Supabase | `uknsayoyvffkxamofczy` (**live client data**) | `eyujzasggzjocsxakkoi` (dev/demo data) |
| Deploy | **`git push origin main`** — Vercel's git integration auto-builds | SSH + `scripts/deploy.sh` |
| Crons | Vercel native, declared in `vercel.json` | host scheduler (`scripts/cron/install-first-crm-cron.sh`) |

> Earlier revisions of this file claimed production ran on the Vultr host and
> that the Vercel path was disabled. That was true only before the 2026-06-03
> move. **`.github/workflows/deploy.yml` is `workflow_dispatch`-only (manual),
> but Vercel's own git integration is live** — pushing `main` deploys the client
> production site whether or not you intended to.
>
> `INCIDENT_RESPONSE.md` describes the same topology for outage handling. If you
> change one, change both — an operator reaching for the wrong host during an
> incident is how a broken client site gets "successfully deployed" to staging.

---

## Client production (Vercel)

### TL;DR

```bash
# 1. Apply any new migrations to the PROD database FIRST (see "Migrations").
# 2. Then deploy — this is the whole deploy step:
git push origin main
# 3. Verify (expect {"ok":true,"db":<ms>} — db is a ping in ms, not a version):
curl -s https://crm.kaufman-finance.com/api/health
```

The build takes ~1–2 minutes. Vercel deploys the **pushed commit**, not your
working tree, so a dirty local tree can't leak into production — but pushing
`main` ships *everything* on `main`, including any parallel agent's commits
sitting below yours. Check `git log <live-sha>..HEAD` first when that matters.

If no deployment appears after ~3–4 minutes, the git webhook was missed: nudge
it with an empty commit (`git commit --allow-empty -m "chore: re-trigger"`).

### Order matters: migrations BEFORE the push

The schema-version gate compares `applied >= expected` (see below). Applying the
migration first keeps the *currently running* build (which expects N−1) green the
whole time, and the new build then goes live already satisfied. Pushing first
inverts it: production serves fine, but `/api/health` reports **503
`schema_behind`** until the SQL runs — which will trip any uptime monitor
watching that URL.

**On Vercel nothing blocks a deploy on the gate.** Unlike the staging path, there
is no pre-swap smoke test — the new build goes live and simply reports unhealthy.
That is why the ordering above is a rule, not a preference.

---

## Migrations (manual, by design)

Migrations are applied **by hand**, *before* deploying, in filename order,
skipping any already applied.

**Route A — Supabase SQL Editor** (default; no local credentials needed):

```
https://supabase.com/dashboard/project/uknsayoyvffkxamofczy/sql/new
```

Paste the migration file's SQL and Run. Prefer migrations written to be
idempotent (`ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) so a re-run is
harmless.

**Route B — `psql` via Docker** (for scripted / multi-file applies). Production
credentials live in **`.env.kaufman-prod`** in the repo root. Two parsing traps:
the `DATABASE_URL` line has a trailing inline comment, and the password contains
characters `psql` misparses when the URL is passed whole — so strip the comment
and pass components (`-h/-p/-U/-d` plus `PGPASSWORD`), never the connection
string. Connect through the transaction pooler
(`aws-1-eu-central-1.pooler.supabase.com:6543`, user `postgres.<project-ref>`).

Notes on credentials, so you don't repeat a dead end:
- `vercel env pull` does **not** give you prod credentials — every sensitive
  value comes back as an empty string.
- `.env.local` points at the **dev** project, not production.
- `supabase/.temp/project-ref` names the prod project, but the Supabase CLI is
  not logged in on the dev machine.

**Never run `supabase db push` against production.** This database's migration
history has always been applied by hand, so
`supabase_migrations.schema_migrations` is not in sync and `db push` would try to
re-run old migrations.

### Schema-version gate (safety net — migration 143)

A forgotten migration would otherwise ship code that 500s on a missing
column/RPC. The sentinel:

- Every migration ends with
  `INSERT INTO public.schema_version (version) VALUES (<N>) ON CONFLICT DO NOTHING;`
  (`<N>` = its numeric filename prefix). `applied_schema_version()` returns `MAX(version)`.
- `next.config.ts` bakes the build's **expected** version (highest file under
  `supabase/migrations/`) into `EXPECTED_SCHEMA_VERSION`.
- `/api/health` returns **503 `schema_behind`** when applied < expected. The
  authorized `?deep=1` view (Bearer `CRON_SECRET`) shows `{ applied, expected }`
  plus the live build SHA — the reliable way to confirm *which* commit is serving.

**When you add a migration, don't forget its `schema_version` self-insert line.**
Omitting it leaves the gate stuck "behind" even after you apply the file
(fail-safe: it blocks, it never ships broken).

---

## Staging / demo host (Vultr)

```bash
# Apply any new migrations to the DEV database first, then:
ssh root@104.207.131.136
curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/deploy.sh -o /opt/deploy-first-crm.sh
docker rm -f first-crm_test 2>/dev/null; SKIP_MIGRATIONS=1 bash /opt/deploy-first-crm.sh
curl -s localhost:3747/api/health      # expect {"ok":true,"db":<ms>}
```

- Run it in the **background** — the Docker build takes 2–4 minutes and a
  foreground timeout can kill it mid-build.
- `DEPLOY_BRANCH=<branch>` deploys any pushed branch (default `main`).
- Safety built into the script: fresh clone → build → **smoke-test on a throwaway
  port** → atomic swap on `:3747` → health check with **auto-rollback** to
  `first-crm:prev`. Production-on-this-host is untouched until the swap, so a
  failed build is a no-op. Previous build kept as image `first-crm:prev` and dir
  `/opt/first-crm_prev`.
- This host's DB does **not** receive migrations automatically. A migration on
  `main` that isn't applied here makes the new image's `EXPECTED_SCHEMA_VERSION`
  exceed the DB, the `:3798` smoke test fails, and the deploy safely aborts with
  the old container still serving.
- If you omit `SKIP_MIGRATIONS=1`, step 6 aborts before the swap (no `supabase`
  CLI and no `SUPABASE_DB_PASSWORD` on the host) — just re-run with the flag.

## Related runbooks

- **Code rollback** → Vercel: promote the previous deployment (`vercel ls --environment production`). Vultr: `first-crm:prev` / `/opt/first-crm_prev`, see `FRANKFURT_MIGRATION_HANDOFF.md`.
- **Data recovery / restore** → `RESTORE_RUNBOOK.md` (Drive restore is merge-only; corruption → PITR).
- **Scheduled jobs** → production crons are declared in `vercel.json` (Vercel native); the Vultr host uses `scripts/cron/install-first-crm-cron.sh`. The nightly backup needs Google Drive connected in-app (Settings → Integrations) or it skips with `drive_not_connected`.
- **First admin / fresh install** → `BOOTSTRAP.md` (the app has no self-signup; needed after a clean-project restore).
- **Security incident / data breach** → `INCIDENT_RESPONSE.md` (contain → assess → recover → notify; secret-rotation checklist).
