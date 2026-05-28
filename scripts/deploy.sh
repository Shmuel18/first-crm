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
#
# Flow (every step reversible; production untouched until the swap):
#   1. Fresh shallow clone of `main` -> /opt/first-crm_new
#   2. PRESERVE the existing .env.production (copy it — never regenerate
#      secrets; regenerating NEXT_SERVER_ACTIONS_ENCRYPTION_KEY would
#      invalidate in-flight server-action IDs in open browser tabs)
#   3. Tag the currently-running image as :prev (rollback point)
#   4. docker build with .env.production mounted as a BuildKit secret
#      (the Dockerfile reads /run/secrets/env_production at build time)
#   5. Smoke-test the new image on a throwaway port BEFORE touching :3747
#   6. Swap: stop+rm old container, run new with the exact same run-config
#   7. Final health check on :3747; auto-rollback to :prev if it fails
#   8. Rotate dirs: first-crm -> first-crm_prev, first-crm_new -> first-crm
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

log()  { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# --- preconditions -----------------------------------------------------------
command -v docker >/dev/null || die "docker not found"
command -v git    >/dev/null || die "git not found"
[ -f "$DIR/$ENV_FILE" ] || die "$DIR/$ENV_FILE missing — cannot preserve env"

# --- 1. fresh clone ----------------------------------------------------------
log "1/8  Fresh clone -> $NEW"
rm -rf "$NEW"
git clone --depth 1 "$REPO" "$NEW"
HEAD_SHA="$(git -C "$NEW" rev-parse --short HEAD)"
ok "cloned main @ $HEAD_SHA"

# --- 2. preserve env (copy — never regenerate) -------------------------------
log "2/8  Preserve $ENV_FILE (copy existing — secrets never regenerated)"
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

# --- 3. rollback point -------------------------------------------------------
log "3/8  Tag running image as $PREV_IMG (rollback point)"
if docker inspect "$NAME" >/dev/null 2>&1; then
  docker tag "$(docker inspect "$NAME" --format '{{.Image}}')" "$PREV_IMG"
  ok "tagged current image as $PREV_IMG"
else
  echo "  (no running $NAME container — first deploy, no rollback point)"
fi

# --- 4. build (env as BuildKit secret) --------------------------------------
log "4/8  Build $IMG (env mounted as BuildKit secret)"
( cd "$NEW" && DOCKER_BUILDKIT=1 docker build \
    --secret id=env_production,src="$ENV_FILE" -t "$IMG" . ) \
  || die "build failed — production untouched, nothing swapped"
ok "image built"

# --- helper: poll an HTTP endpoint until it answers --------------------------
wait_http() { # $1=port
  local port="$1" code
  for _ in $(seq 1 20); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:${port}/" || true)"
    case "$code" in 200|301|302|307|308) return 0 ;; esac
    sleep 2
  done
  return 1
}

# --- 5. smoke-test new image on a throwaway port -----------------------------
log "5/8  Smoke-test new image on :$TEST_PORT (before swap)"
docker rm -f "${NAME}_test" >/dev/null 2>&1 || true
docker run -d --name "${NAME}_test" --env-file "$NEW/$ENV_FILE" -p "$TEST_PORT:$PORT" "$IMG" >/dev/null
if wait_http "$TEST_PORT"; then ok "new image healthy on :$TEST_PORT"; SMOKE=1; else SMOKE=0; fi
docker rm -f "${NAME}_test" >/dev/null 2>&1 || true
[ "$SMOKE" = 1 ] || die "new image failed smoke test — production untouched"

# --- 6. swap -----------------------------------------------------------------
log "6/8  Swap container on :$PORT"
docker stop "$NAME" >/dev/null 2>&1 || true
docker rm   "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --env-file "$NEW/$ENV_FILE" \
  -p "$PORT:$PORT" --restart unless-stopped "$IMG" >/dev/null

# --- 7. final health check + auto-rollback -----------------------------------
log "7/8  Final health check on :$PORT"
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

# --- 8. rotate dirs ----------------------------------------------------------
log "8/8  Rotate dirs (keep previous as $PREV)"
rm -rf "$PREV"
mv "$DIR" "$PREV"
mv "$NEW" "$DIR"
docker image prune -f >/dev/null 2>&1 || true

ok "deploy complete — $NAME live on :$PORT (build $HEAD_SHA)"
