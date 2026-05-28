# Frankfurt Migration Handoff

Last updated: 2026-05-28

## Executive Summary

The CRM was cloned from the Tokyo Vultr server to a new Frankfurt Vultr server using a Vultr snapshot. The new server is live and significantly faster for Supabase/Postgres-bound CRM requests because it is now close to the Supabase pooler in `eu-central-1`.

The DNS records have not been moved yet. Public domains still point to Tokyo. The Frankfurt server is currently available directly by IP for testing.

## Servers

### Old Server - Tokyo

- Provider: Vultr
- Location: Tokyo, JP
- IP: `149.28.23.129`
- Host label: `RateBridge Production Tokyo`
- SSH: `ssh root@149.28.23.129`
- Status: still running
- Role: current DNS target for existing domains

### New Server - Frankfurt

- Provider: Vultr
- Location: Frankfurt, DE
- IP: `104.207.131.136`
- Plan: `vhf-2c-4gb`
- Resources: 2 vCPU, 4 GB RAM, 128 GB storage
- SSH: `ssh root@104.207.131.136`
- Status: running
- Role: new target server for CRM and eventually all services

## CRM URLs

### Current Tokyo CRM

```text
http://149.28.23.129:3747/login
```

### New Frankfurt CRM

```text
http://104.207.131.136:3747/login
```

Current Frankfurt CRM build:

```text
10da597 Fix draft temp ids on insecure origins
```

Existing CRM user accounts/passwords are unchanged from the Tokyo environment. Do not put passwords in repo docs or agent messages.

## DNS State

As of this handoff, DNS still points to Tokyo:

```text
herskoviccrm.com -> 149.28.23.129
botview.live     -> 149.28.23.129
ratebridge.live  -> 149.28.23.129
```

Do not delete the Tokyo server before DNS is moved and verified.

## Services On Frankfurt

Running after snapshot restore:

- `first-crm` Docker container on `0.0.0.0:3747`
- `moishesh-dashboard` Docker container on `0.0.0.0:3737`
- `trinity-grafana` on `127.0.0.1:3000`
- `trinity-prometheus` on `127.0.0.1:9090`
- `trinity-redis` on `127.0.0.1:6379`
- `trinity-cadvisor`
- `trinity-node-exporter`
- `trinity-redis-exporter`
- `polybot-dashboard.service`
- `nginx.service`
- `docker.service`
- `fail2ban.service`

Intentionally stopped on Frankfurt:

- `trinity-bot`
- `polybot.service`

Reason: the snapshot started automation/bot workloads in parallel with Tokyo. They must remain stopped on Frankfurt until the cutover is intentional.

## Important Safety Notes

Do not start `trinity-bot` on Frankfurt until:

1. Exchange API IP whitelists are updated from `149.28.23.129` to `104.207.131.136`.
2. Tokyo bot is stopped or the cutover is coordinated.
3. The operator confirms that live trading should move to Frankfurt.

Do not start `polybot.service` on Frankfurt until:

1. The owner confirms duplicate bot execution is safe or Tokyo is stopped.
2. Any external webhooks/API limits have been checked.

Do not delete Tokyo until:

1. DNS is moved.
2. CRM is verified on the new DNS.
3. Any bot/integration cutover is complete.
4. At least 24 hours of stable operation have passed.

## Deployment

The CRM deploy script exists on Frankfurt:

```text
/opt/deploy-first-crm.sh
```

Deploy latest `main` to Frankfurt:

```bash
ssh root@104.207.131.136
bash /opt/deploy-first-crm.sh
```

The script:

1. Fresh-clones `main` into `/opt/first-crm_new`
2. Preserves `/opt/first-crm/.env.production`
3. Stamps `NEXT_DEPLOYMENT_ID`
4. Tags rollback image as `first-crm:prev`
5. Builds with Docker BuildKit secret
6. Smoke-tests on `127.0.0.1:3798`
7. Swaps the live container on `:3747`
8. Keeps previous directory as `/opt/first-crm_prev`

Rollback options:

- Docker image: `first-crm:prev`
- Previous directory: `/opt/first-crm_prev`

## Environment Notes

Frankfurt CRM env was updated:

```text
NEXT_PUBLIC_APP_URL=http://104.207.131.136:3747
```

Known optional-but-critical missing CRM config:

```text
RESEND_API_KEY / EMAIL_FROM
```

Impact: invite emails are not sent automatically; invitation links must be shared manually.

## Performance Measurements

Measured from the servers against their local CRM containers and the shared Supabase/Postgres backend.

### `/api/health` - DB-bound check

Frankfurt, after warm-up:

```text
db: ~24-51 ms
total: ~30-56 ms
```

Tokyo, after warm-up:

```text
db: ~253-262 ms
total: ~259-287 ms
```

Tokyo also showed intermittent cold/spike values:

```text
db: 776-1264 ms
```

Conclusion: the Frankfurt move removes roughly 200-230 ms from every DB round trip and is about 5x-8x faster for DB-bound operations.

### `/login`

Login is mostly static/lightweight, so it is not the main benchmark.

Frankfurt warm:

```text
~22-36 ms
```

Tokyo warm:

```text
~28-66 ms
```

The main CRM improvement will be felt on authenticated pages/actions that hit Supabase repeatedly.

## Recent CRM Fix For IP Testing

Opening the CRM over plain HTTP by IP exposed a browser issue:

```text
crypto.randomUUID is not a function
```

Fix:

```text
10da597 Fix draft temp ids on insecure origins
```

The code now falls back to `crypto.getRandomValues()` for client-only temporary draft IDs when `randomUUID()` is unavailable.

Verified locally before deploy:

- `npm run lint` passed with one unrelated existing warning
- `npm test` passed: 160/160
- `npm run build` passed

## Known Local Worktree Note

At the time of this handoff, local git had unrelated uncommitted changes in files outside the migration fix. Do not blindly commit all local changes without review.

Unrelated dirty files observed:

- `src/app/(app)/cases/[id]/history/page.tsx`
- `src/app/(app)/error.tsx`
- `src/app/api/cron/backup/route.ts`
- `src/app/api/cron/cleanup-orphaned-blobs/route.ts`
- `src/app/global-error.tsx`
- `src/features/audit/services/audit.service.ts`
- `src/features/backup/actions/run-backup.ts`
- `src/features/team/actions/invite-member.ts`

## Suggested Cutover Plan

1. Verify CRM manually on:

   ```text
   http://104.207.131.136:3747/login
   ```

2. Decide which domains should move to Frankfurt.
3. Lower DNS TTL if the DNS provider allows it.
4. Update A records from:

   ```text
   149.28.23.129
   ```

   to:

   ```text
   104.207.131.136
   ```

5. Verify nginx HTTPS vhosts after propagation.
6. Keep Tokyo online for at least 24 hours.
7. Only then destroy the Tokyo server and delete temporary snapshots if no longer needed.

