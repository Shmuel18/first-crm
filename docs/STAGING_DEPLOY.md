# Deploying first-crm to the Vultr staging host

> Canonical staging runbook (verified 2026-08-15 against the live host and
> `scripts/deploy.sh`). Production deploys are NOT done from here — see
> `DEPLOYING.md` for the production/staging split.

## What this host is
- `root@104.207.131.136`, app on port **3747**, Docker container `first-crm`.
- This is **STAGING**, not the client's production. Production is Vercel
  (`crm.kaufman-finance.com`), auto-deployed on push to `main`.
- Staging reads the **dev Supabase** (`eyujzasggzjocsxakkoi`) — the same DB as
  local `.env.local`. Client prod is a different project
  (`uknsayoyvffkxamofczy`). Deploying here can never touch client data.
- The host is shared with other projects. Only ever touch the `first-crm`
  container and `/opt/first-crm*`. Never edit other containers or nginx.

## Pre-flight (skip this and the deploy will fail safely, but pointlessly)
`next.config.ts` bakes `EXPECTED_SCHEMA_VERSION` = the highest migration number
in `supabase/migrations/`, and `/api/health` returns 503 while the DB's
`applied_schema_version()` is lower. So if the branch carries migrations the
**dev DB doesn't have yet**, the new image fails its smoke test and the deploy
aborts (production untouched — a safe fail, but wasted 4 minutes).

1. Highest migration on the branch you're deploying:
   `git ls-tree -r origin/<branch> --name-only -- supabase/migrations/ | sort | tail -1`
2. Highest applied on the dev DB: `SELECT MAX(version) FROM schema_version;`
   (connect with node+pg using `.env.local` — see the connection traps below).
3. If the DB is behind, apply the missing migrations to the dev DB FIRST.
   Watch for migrations pushed to `main` by parallel agents — they gate you too.

## The deploy command
Fetch the official script fresh from `main` every time and run it on the server.
Do **not** hand-roll docker commands.

```bash
ssh -o BatchMode=yes root@104.207.131.136 \
  'docker rm -f first-crm_test 2>/dev/null; \
   curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/deploy.sh \
     -o /opt/deploy-first-crm.sh && \
   SKIP_MIGRATIONS=1 bash /opt/deploy-first-crm.sh'
```

Three things that are load-bearing:
- **Run it in the BACKGROUND** (`run_in_background: true`). The Docker
  `next build` takes 2-4 minutes; a foreground tool timeout kills it mid-build.
- **`SKIP_MIGRATIONS=1` is mandatory on this host.** Step 6 of the script runs
  `supabase db push`, but the host has no `supabase` CLI and no
  `SUPABASE_DB_PASSWORD` in `.env.production` — without the flag the deploy just
  aborts before the swap. Migrations here are applied by hand (pre-flight above).
  Never "fix" this by running `supabase db push`: this DB's migration history was
  always applied manually, so the Supabase tracking table is out of sync and
  `db push` would try to re-run old migrations.
- **`docker rm -f first-crm_test`** clears a throwaway container that a
  previously-aborted deploy can leave behind on :3798, which otherwise fails
  step 5 with a name conflict.

Deploying a branch other than `main`: prefix `DEPLOY_BRANCH=<branch>`. The branch
must be pushed to origin — the script does a fresh shallow clone, it does not
see your working tree.

## What the script does (why it's safe)
Fresh clone → preserve the existing `.env.production` (never regenerates
secrets) → tag the running image as `first-crm:prev` → build with the env as a
BuildKit secret → **smoke-test on throwaway :3798** → swap :3747 → final health
check with **auto-rollback to `:prev`** → rotate dirs. Production on :3747 is
untouched until the swap, and any failure before it leaves the old container
serving.

## Verify after every deploy
```bash
curl -s http://104.207.131.136:3747/api/health          # -> {"ok":true,"db":<ms>}
curl -s -o /dev/null -w "%{http_code}" http://104.207.131.136:3747/login   # -> 200
```
`db` is the DB round-trip in **milliseconds**, not a schema version.

The deploy log tail should end with
`✓ deploy complete — first-crm live on :3747 (build <sha>)`. To confirm which
commit is actually live plus the schema numbers, use the deep endpoint with the
`CRON_SECRET` from **local `.env.local`** (it authenticates against staging):
```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" \
  "http://104.207.131.136:3747/api/health?deep=1"
```
On staging this returns `ok:false` because `drive: degraded (disconnected)` —
that's the expected baseline here. The pass signal is `db`, `schema`,
`cronSecret` and `keys` all `ok`, and `build` == your commit sha.

Then open the feature you actually changed in a browser and confirm it works.
Health checks don't catch runtime breakage.

## Diagnosing a failed or half deploy
```bash
docker ps -a --filter name=first-crm   # which image, uptime
ls -d /opt/first-crm_new               # leftover dir = a deploy died mid-run
pgrep -af deploy-first-crm             # is one still running?
docker images first-crm                # :latest vs :prev ages
```
Clean state = container Up on the expected build, no `first-crm_new`, no running
deploy process.

## DB connection traps (when you need the dev DB directly)
Use node+pg (the `pg` dep is installed) or a dockerized `psql`; a native `psql`
may not exist on Windows. **Never pass the connection URL whole** — the passwords
in both env files contain characters that make libpq misparse the userinfo.
Parse into components (`{user, password, host, port, database}`) instead, split
the userinfo at the LAST `@`, and strip the trailing inline `#` comment on the
`.env.kaufman-prod` line.

## Don'ts
- Don't echo `DATABASE_URL` or any secret into the transcript.
- Don't deploy without the migration pre-flight.
- Don't run `supabase db push` against this DB.
- Deploy needs explicit user authorization each time.
- Test/QA accounts on staging: `demo.admin@kaufman.test` (admin),
  `demo.advisor@kaufman.test` (junior advisor). Staging data is fake — safe to
  show, safe to break.

## Perlstein demo rebrand (white-label)

Staging doubles as the Perlstein sales demo. `scripts/rebrand-demo-perlstein.sh`
wraps this runbook's deploy flow and flips the brand:

```bash
ssh -o BatchMode=yes root@104.207.131.136 \
  "curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/claude/kupman-system-perlstein-adapt-1f7u5f/scripts/rebrand-demo-perlstein.sh | SKIP_CONFIRM=1 bash"
```

It verifies the host points at the dev Supabase (hard-aborts on the prod ref),
upserts `NEXT_PUBLIC_BRAND=perlstein` + `NEXT_PUBLIC_APP_NAME` into
`.env.production`, clears `first-crm_test`, fetches `deploy.sh` fresh from
`main`, deploys with `SKIP_MIGRATIONS=1 DEPLOY_BRANCH=<white-label branch>`,
and health-checks `/api/health` + `/login`. Revert by setting
`NEXT_PUBLIC_BRAND=kaufman` and redeploying `main`.
