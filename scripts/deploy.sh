#!/usr/bin/env bash
# =============================================================================
# Official deploy script for the first-crm DEMO on the shared Vultr host.
# =============================================================================
# Run this ON THE SERVER. It is the single source of truth for deploying the
# demo, so different sessions/agents stop inventing ad-hoc flows that confuse
# temp-env vs persistent-env vs stale clones vs Docker cache.
#
#   Fetch + run (recommended):
#     curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/deploy.sh -o /opt/deploy-first-crm.sh
#     bash /opt/deploy-first-crm.sh
#   Deploy a non-default branch (e.g. once this host becomes the dev/staging
#   environment after Vercel owns production for `main`):
#     DEPLOY_BRANCH=dev bash /opt/deploy-first-crm.sh
#
# Flow (every step reversible; production untouched until the swap):
#   1. Fresh shallow clone of $BRANCH (DEPLOY_BRANCH, default main) -> /opt/first-crm_new
#   2. PRESERVE the existing .env.production (copy it — never regenerate
#      secrets; regenerating NEXT_SERVER_ACTIONS_ENCRYPTION_KEY would
#      invalidate in-flight server-action IDs in open browser tabs)
#   3. Tag the currently-running image as :prev (rollback point)
#   4. docker build with .env.production mounted as a BuildKit secret
#      (the Dockerfile reads /run/secrets/env_production at build time)
#   5. Smoke-test the new image on a throwaway port BEFORE touching :3747
#   6. Apply DB migrations (supabase db push) BEFORE the swap, so new code
#      never serves against a schema missing its columns/RPCs. Aborts the
#      deploy on failure. Skippable with SKIP_MIGRATIONS=1 (supervised migrate).
#   7. Swap: stop+rm old container, run new with the exact same run-config
#   8. Final health check on :3747; auto-rollback to :prev if it fails
#   9. Rotate dirs: first-crm -> first-crm_prev, first-crm_new -> first-crm
#
# Hard rules (shared host with trinity / moishesh / polybot):
#   * Only ever touches the `first-crm` container + /opt/first-crm* dirs.
#   * Never edits other projects' containers, vhosts, or nginx config.
#   * Never generates new secrets. If a required env var is missing it ABORTS
#     and tells you to add it — it does not invent a value.
# =============================================================================

set -euo pipefail

REPO="https://github.com/Shmuel18/first-crm"
ROOT="/opt"
NAME="first-crm"
DIR="$ROOT/$NAME"
NEW="$ROOT/${NAME}_new"
PREV="$ROOT/${NAME}_prev"
PORT=3747
TEST_PORT=3798
IMG="first-crm:latest"
PREV_IMG="first-crm:prev"
ENV_FILE=".env.production"
# Branch this host deploys. Default stays `main` so this stays a no-op for the
# current setup. Once Vercel owns production for `main`, this Vultr host becomes
# the dev/staging environment — flip the default to `dev` here (or pass
# DEPLOY_BRANCH=dev per run) so it serves the dev line instead of production.
BRANCH="${DEPLOY_BRANCH:-main}"

log()  { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# --- preconditions -----------------------------------------------------------
command -v docker >/dev/null || die "docker not found"
command -v git    >/dev/null || die "git not found"
[ -f "$DIR/$ENV_FILE" ] || die "$DIR/$ENV_FILE missing — cannot preserve env"

# --- 1. fresh clone ----------------------------------------------------------
log "1/9  Fresh clone ($BRANCH) -> $NEW"
rm -rf "$NEW"
git clone --depth 1 --branch "$BRANCH" "$REPO" "$NEW"
HEAD_SHA="$(git -C "$NEW" rev-parse --short HEAD)"
ok "cloned $BRANCH @ $HEAD_SHA"

# --- 2. preserve env (copy — never regenerate) -------------------------------
log "2/9  Preserve $ENV_FILE (copy existing — secrets never regenerated)"
cp "$DIR/$ENV_FILE" "$NEW/$ENV_FILE"
# These are the build-time-required keys the env schema enforces in prod.
# Abort early with a clear message instead of a cryptic 'next build' failure.
for k in SUPABASE_SERVICE_ROLE_KEY DATABASE_URL INTEGRATION_ENCRYPTION_KEY \
         BACKUP_ENCRYPTION_KEY NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
         NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  grep -qE "^${k}=" "$NEW/$ENV_FILE" \
    || die "$k missing from $DIR/$ENV_FILE — add it before deploying (build will fail without it)"
done
ok "env preserved + required keys present"

# Keep secrets stable, but stamp the non-secret deployment id for this build.
# next.config.ts consumes it at build time, and /api/health reports it so we
# can verify which commit is actually running after a swap.
if grep -qE "^NEXT_DEPLOYMENT_ID=" "$NEW/$ENV_FILE"; then
  sed -i "s#^NEXT_DEPLOYMENT_ID=.*#NEXT_DEPLOYMENT_ID=$HEAD_SHA#" "$NEW/$ENV_FILE"
else
  printf '\nNEXT_DEPLOYMENT_ID=%s\n' "$HEAD_SHA" >> "$NEW/$ENV_FILE"
fi
ok "deployment id stamped as $HEAD_SHA"

# --- 3. rollback point -------------------------------------------------------
log "3/9  Tag running image as $PREV_IMG (rollback point)"
# Tag the current :latest (= the running build) as :prev. We tag the REPO:TAG,
# NOT `docker inspect <container> .Image`: BuildKit/containerd report the
# container's image as a config DIGEST that `docker tag` can't reference
# ("No such image: sha256:…"), which aborted the deploy at this step. The
# :latest tag points at the same running image and IS taggable.
if docker image inspect "$IMG" >/dev/null 2>&1; then
  docker tag "$IMG" "$PREV_IMG"
  ok "tagged $IMG as $PREV_IMG"
elif docker inspect "$NAME" >/dev/null 2>&1; then
  # No :latest (unusual) — fall back to the container's image id; tolerate
  # failure so a quirky image store can't block the whole deploy.
  docker tag "$(docker inspect "$NAME" --format '{{.Image}}')" "$PREV_IMG" \
    || echo "  (couldn't tag running image — proceeding without a rollback point)"
else
  echo "  (no running $NAME container — first deploy, no rollback point)"
fi

# --- 4. build (env as BuildKit secret) --------------------------------------
log "4/9  Build $IMG (env mounted as BuildKit secret)"
( cd "$NEW" && DOCKER_BUILDKIT=1 docker build \
    --secret id=env_production,src="$ENV_FILE" -t "$IMG" . ) \
  || die "build failed — production untouched, nothing swapped"
ok "image built"

# --- helper: poll /api/health until the DATA PLANE is up --------------------
wait_http() { # $1=port — up only when /api/health reports the data plane is up
  # /api/health does a real DB round-trip and returns 503 if the DB is
  # unreachable. GET / would 200 from the login shell even with a broken DB,
  # passing the smoke test AND the post-swap gate so auto-rollback never fires.
  # Requiring 200 + {"ok":true} makes both gates catch data-plane failures.
  local port="$1" body
  for _ in $(seq 1 20); do
    if body="$(curl -fsS --max-time 5 "http://localhost:${port}/api/health" 2>/dev/null)"; then
      case "$body" in *'"ok":true'*) return 0 ;; esac
    fi
    sleep 2
  done
  return 1
}

# --- 5. smoke-test new image on a throwaway port -----------------------------
log "5/9  Smoke-test new image on :$TEST_PORT (before swap)"
docker rm -f "${NAME}_test" >/dev/null 2>&1 || true
docker run -d --name "${NAME}_test" --env-file "$NEW/$ENV_FILE" -p "$TEST_PORT:$PORT" "$IMG" >/dev/null
if wait_http "$TEST_PORT"; then ok "new image healthy on :$TEST_PORT"; SMOKE=1; else SMOKE=0; fi
docker rm -f "${NAME}_test" >/dev/null 2>&1 || true
[ "$SMOKE" = 1 ] || die "new image failed smoke test — production untouched"

# --- 6. apply DB migrations BEFORE the swap ----------------------------------
# New code must never serve against a schema missing its columns/RPCs — the #1
# cause of post-deploy 500s this script was missing. Migrations are additive,
# so the still-running OLD container is safe against the new schema for the few
# seconds until the swap; a migration failure ABORTS before the swap, leaving
# production on the old image. Mechanism mirrors the (disabled) CI deploy.yml —
# supabase link + db push — but reads the 3 migration secrets from the
# preserved .env.production instead of GitHub secrets. `db push` only applies
# migrations not yet recorded remotely, so it is a no-op when nothing pends.
#
# SKIP_MIGRATIONS=1 ships code WITHOUT migrating — use ONLY when a sensitive
# migration (e.g. the audit-log re-partition) was already applied by hand in a
# supervised window and you just want to deploy the code.
log "6/9  Apply DB migrations (before swap)"
if [ "${SKIP_MIGRATIONS:-0}" = 1 ]; then
  printf '\033[1;31m  ⚠ SKIP_MIGRATIONS=1 — not applying migrations; asserting the remote\n     schema is already up to date. New code will 500 if it is not.\033[0m\n'
else
  command -v supabase >/dev/null \
    || die "supabase CLI not found on host. Install once: curl -fsSL https://supabase.com/install.sh | sh  (or see https://supabase.com/docs/guides/cli), then re-run. To ship code without migrating, re-run with SKIP_MIGRATIONS=1."
  get_env() { # $1=key — read a value from the preserved env file, strip quotes
    local v
    v="$(grep -E "^$1=" "$NEW/$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    v="${v%$'\r'}"                                  # strip trailing CR (CRLF-safe)
    v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
    printf '%s' "$v"
  }
  MIG_REF="$(get_env SUPABASE_PROJECT_REF)"
  MIG_PW="$(get_env SUPABASE_DB_PASSWORD)"
  MIG_TOKEN="$(get_env SUPABASE_ACCESS_TOKEN)"
  { [ -n "$MIG_REF" ] && [ -n "$MIG_PW" ] && [ -n "$MIG_TOKEN" ]; } || die \
"migration secrets missing from $DIR/$ENV_FILE. Add these 3 lines once (ref + DB
   password from the Supabase dashboard; access token from
   supabase.com/dashboard/account/tokens), then re-run:
     SUPABASE_PROJECT_REF=...
     SUPABASE_DB_PASSWORD=...
     SUPABASE_ACCESS_TOKEN=...
   Or ship without migrating via SKIP_MIGRATIONS=1 if you applied them manually."
  ( cd "$NEW" \
      && SUPABASE_ACCESS_TOKEN="$MIG_TOKEN" supabase link --project-ref "$MIG_REF" --password "$MIG_PW" \
      && SUPABASE_ACCESS_TOKEN="$MIG_TOKEN" supabase db push --password "$MIG_PW" ) \
    || die "DB migration failed — production untouched, nothing swapped. Fix or apply the migration, then re-run."
  ok "migrations applied — remote schema up to date"
fi

# --- 7. swap -----------------------------------------------------------------
log "7/9  Swap container on :$PORT"
docker stop "$NAME" >/dev/null 2>&1 || true
docker rm   "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --env-file "$NEW/$ENV_FILE" \
  -p "$PORT:$PORT" --restart unless-stopped "$IMG" >/dev/null

# --- 8. final health check + auto-rollback -----------------------------------
log "8/9  Final health check on :$PORT"
if ! wait_http "$PORT"; then
  log "✖ health check FAILED — rolling back to $PREV_IMG"
  docker stop "$NAME" >/dev/null 2>&1 || true
  docker rm   "$NAME" >/dev/null 2>&1 || true
  if docker inspect "$PREV_IMG" >/dev/null 2>&1; then
    docker run -d --name "$NAME" --env-file "$DIR/$ENV_FILE" \
      -p "$PORT:$PORT" --restart unless-stopped "$PREV_IMG" >/dev/null
    die "rolled back to previous image — investigate before retrying"
  fi
  die "health check failed and no $PREV_IMG to roll back to — $NAME is DOWN"
fi
ok "live + healthy on :$PORT"

# --- 9. rotate dirs ----------------------------------------------------------
log "9/9  Rotate dirs (keep previous as $PREV)"
rm -rf "$PREV"
mv "$DIR" "$PREV"
mv "$NEW" "$DIR"
docker image prune -f >/dev/null 2>&1 || true

ok "deploy complete — $NAME live on :$PORT (build $HEAD_SHA)"
