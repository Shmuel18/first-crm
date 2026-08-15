# Deploying first-crm

> **Two environments — do not mix them up:**
>
> | | Production (Kaufman) | Staging / demo |
> |---|---|---|
> | Where | Vercel — `crm.kaufman-finance.com` | Vultr host `104.207.131.136`, Docker on `:3747` |
> | Deploys | **Automatically on every push to `main`** (Vercel git integration) | Manually via `scripts/deploy.sh` — see [`STAGING_DEPLOY.md`](./STAGING_DEPLOY.md) |
> | Supabase | prod project (`uknsayoyvffkxamofczy`) | dev project (`eyujzasggzjocsxakkoi`) |
> | Data | REAL client data | fake demo data (safe to break) |
>
> An earlier version of this file described the Vultr host as production —
> that is outdated. The Vultr host is staging/demo only; it also serves as
> the **Perlstein white-label demo** (see `STAGING_DEPLOY.md` → "Perlstein
> demo rebrand"). The `.github/workflows/deploy.yml` Actions pipeline is
> disabled (`workflow_dispatch` only).

## Production TL;DR

1. If your change adds migrations: **apply them to the prod Supabase FIRST**
   (SQL Editor, in filename order — see "Migrations" below). Merging first
   would let Vercel ship a build whose schema gate 503s until the migration
   lands.
2. Merge/push to `main` → Vercel builds and deploys automatically.
3. Verify: `https://crm.kaufman-finance.com/api/health` → `{"ok":true,...}`.

## Migrations (manual, by design)

Migrations are applied **by hand in the Supabase SQL Editor** of the target
environment (prod project for production, dev project for staging), *before*
the code that needs them deploys.

When a PR adds files under `supabase/migrations/`:
1. Supabase Dashboard → **SQL Editor** (of the right project!).
2. Run each NEW migration's SQL, in filename order (oldest first). Apply only
   the ones not yet applied.

**Why not auto-apply on deploy?** `scripts/deploy.sh` step 6 *can* run
`supabase db push`, but that requires the migration-history table
(`supabase_migrations.schema_migrations`) to be in sync — which it is **not**
when migrations are applied via the SQL Editor. Keeping migrations manual
avoids a risky one-time history reconciliation. **Never run `supabase db
push` against these DBs** — it would try to re-run old migrations.

### Schema-version gate (safety net — migration 143)

A forgotten migration would ship code that 500s on a missing column/RPC.
A sentinel catches that **before** users do:

- Every migration ends with `INSERT INTO public.schema_version (version) VALUES (<N>) ON CONFLICT DO NOTHING;`
  (`<N>` = its numeric prefix). `applied_schema_version()` returns `MAX(version)`.
- `next.config.ts` bakes the build's **expected** version (the highest file
  under `supabase/migrations/`) into `EXPECTED_SCHEMA_VERSION`.
- `/api/health` returns **503 `schema_behind`** when applied < expected. On
  staging the deploy script smoke-tests `/api/health` before the swap, so a
  lagging DB **aborts the deploy** (the old container keeps serving). On
  Vercel a lagging DB surfaces as a 503 health check until the migration is
  applied.

**Consequence:** apply pending migrations **first**. And when you add a
migration, don't forget its `schema_version` self-insert line — omitting it
leaves the gate stuck "behind" after you apply the file (fail-safe: it
blocks, never ships broken).

## Related runbooks

- **Staging / demo deploys (Vultr)** → [`STAGING_DEPLOY.md`](./STAGING_DEPLOY.md)
  — includes the Perlstein rebrand flow and failure diagnosis.
- **Data recovery / restore** → `RESTORE_RUNBOOK.md` (Drive restore is
  merge-only; corruption → PITR).
- **Scheduled jobs (cron)** → installed by
  `scripts/cron/install-first-crm-cron.sh` (host scheduler on staging). The
  nightly backup needs Google Drive connected in-app (Settings →
  Integrations) or it skips with `drive_not_connected`.
- **First admin / fresh install** → `BOOTSTRAP.md` (provision the first
  manager on an empty DB — the app has no self-signup).
- **Security incident / data breach** → `INCIDENT_RESPONSE.md`
  (contain → assess → recover → notify; secret-rotation checklist).
