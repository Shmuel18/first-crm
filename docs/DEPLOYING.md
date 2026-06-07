# Deploying first-crm (production)

> Production runs as a **Docker container on the Vultr host** — NOT Vercel.
> (The Vercel + `.github/workflows/deploy.yml` path is historical and disabled.)
> Host IP / SSH details: see `FRANKFURT_MIGRATION_HANDOFF.md`.

## TL;DR

```bash
# 1. If the PR added migrations, apply them FIRST in the Supabase SQL Editor
#    (see "Migrations" below). Then:
ssh root@<vultr-host>
curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/deploy.sh -o /opt/deploy-first-crm.sh
SKIP_MIGRATIONS=1 bash /opt/deploy-first-crm.sh
# 2. Verify:
curl -s localhost:3747/api/health      # expect {"ok":true,"db":<ms>}
```

## Migrations (manual, by design)

Migrations are applied **by hand in the Supabase SQL Editor**, *before* deploying.
The deploy is therefore always run with **`SKIP_MIGRATIONS=1`** — `deploy.sh` does
not apply migrations itself in this workflow.

When a PR adds files under `supabase/migrations/`:
1. Supabase Dashboard → **SQL Editor**.
2. Run each NEW migration's SQL, in filename order (oldest first). Apply only the
   ones not yet applied.
3. Deploy with `SKIP_MIGRATIONS=1` (above).

**Why not auto-apply on deploy?** `deploy.sh` step 6 *can* run `supabase db push`
(omit `SKIP_MIGRATIONS`), but that requires the migration-history table
(`supabase_migrations.schema_migrations`) to be in sync — which it is **not** when
migrations are applied via the SQL Editor. Keeping migrations manual avoids a
risky one-time history reconciliation on the production DB.

**To switch to auto-migrate later:** stop using the SQL Editor for migrations,
reconcile the history once (`supabase migration repair --status applied ...`),
install the Supabase CLI on the host, and deploy **without** `SKIP_MIGRATIONS`
(step 6 derives a session connection from `DATABASE_URL` — no extra secret).

### Schema-version gate (safety net — migration 143)

Because migrations are manual + `SKIP_MIGRATIONS=1`, a forgotten migration would
ship code that 500s on a missing column/RPC. A sentinel catches that **before**
the swap:

- Every migration ends with `INSERT INTO public.schema_version (version) VALUES (<N>) ON CONFLICT DO NOTHING;`
  (`<N>` = its numeric prefix). `applied_schema_version()` returns `MAX(version)`.
- `next.config.ts` bakes the build's **expected** version (the highest file under
  `supabase/migrations/`) into `EXPECTED_SCHEMA_VERSION`.
- `/api/health` returns **503 `schema_behind`** when applied < expected. `deploy.sh`
  smoke-tests `/api/health` before the swap, so a lagging DB **aborts the deploy**
  (production untouched). The authorized `?deep=1` view shows `{ applied, expected }`.

**Consequence:** apply pending migrations **first** (as already documented). If a
deploy aborts at the smoke test, check `curl -s localhost:3747/api/health` — a
`schema_behind` means a migration wasn't applied yet. **When you add a migration,
don't forget its `schema_version` self-insert line** — omitting it leaves the gate
stuck "behind" after you apply the file (fail-safe: it blocks, never ships broken).

## Deploy safety (built into `scripts/deploy.sh`)

- Fresh-clones `main`; **preserves** `.env.production` (never regenerates secrets).
- Builds + **smoke-tests** the new image on a throwaway port BEFORE touching `:3747`.
- Swaps the container, runs a health check, and **auto-rolls-back to `first-crm:prev`** if it fails.
- Keeps the previous build: image `first-crm:prev`, dir `/opt/first-crm_prev`.

If you forget `SKIP_MIGRATIONS=1`, step 6 aborts **before the swap** with a clear
message (production untouched) — just re-run with the flag.

## Related runbooks

- **Code rollback** → `FRANKFURT_MIGRATION_HANDOFF.md` (`first-crm:prev` / `/opt/first-crm_prev`).
- **Data recovery / restore** → `RESTORE_RUNBOOK.md` (Drive restore is merge-only; corruption → PITR).
- **Scheduled jobs (cron)** → installed by `scripts/cron/install-first-crm-cron.sh` (host scheduler, not Vercel cron). The nightly backup needs Google Drive connected in-app (Settings → Integrations) or it skips with `drive_not_connected`.
- **First admin / fresh install** → `BOOTSTRAP.md` (provision the first manager on an empty DB — the app has no self-signup; needed after a clean-project restore).
- **Security incident / data breach** → `INCIDENT_RESPONSE.md` (contain → assess → recover → notify; secret-rotation checklist).
