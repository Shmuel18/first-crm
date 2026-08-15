#!/usr/bin/env bash
# Rebrand the STAGING host (Vultr, :3747) to Perlstein and deploy the
# white-label branch. Kaufman production (Vercel, crm.kaufman-finance.com,
# prod Supabase) is a different server + different DB — this cannot touch it.
#
# Runs ON the staging host. One-liner from a machine with SSH access
# (run it in the background — the Docker build takes 2-4 minutes):
#
#   ssh -o BatchMode=yes root@104.207.131.136 \
#     "curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/claude/kupman-system-perlstein-adapt-1f7u5f/scripts/rebrand-demo-perlstein.sh | bash"
#
# What it does:
#   0. Verifies .env.production points at the DEV Supabase project (hard
#      abort if it somehow points at Kaufman production; prompt if unknown).
#   1. Upserts NEXT_PUBLIC_BRAND=perlstein + NEXT_PUBLIC_APP_NAME.
#   2. Clears any leftover smoke-test container, fetches the official
#      deploy.sh fresh from main, and deploys DEPLOY_BRANCH=<the white-label
#      branch> with SKIP_MIGRATIONS=1 (mandatory on this host: migrations
#      are applied by hand and the branch adds none; the schema gate in
#      /api/health still aborts safely if the dev DB were behind).
#   3. Health-checks the swapped container (+ /login status).
#
# Revert: set NEXT_PUBLIC_BRAND=kaufman in .env.production and rerun
#   SKIP_MIGRATIONS=1 bash /opt/deploy-first-crm.sh
set -euo pipefail

BRANCH="claude/kupman-system-perlstein-adapt-1f7u5f"
ENV_FILE="/opt/first-crm/.env.production"
DEPLOY_SCRIPT="/opt/deploy-first-crm.sh"
DEPLOY_SRC="https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/deploy.sh"
# Supabase project refs (not secrets — they appear in every client-side URL).
DEV_REF="eyujzasggzjocsxakkoi"
PROD_REF="uknsayoyvffkxamofczy"

log() { printf '\033[1;34m[rebrand]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[rebrand] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found — is this the staging host?"

# --- 0. DB sanity gate -------------------------------------------------------
SUPA_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
log "Staging Supabase project: ${SUPA_URL:-<missing>}"
case "$SUPA_URL" in
  *"$PROD_REF"*)
    die "env points at KAUFMAN PRODUCTION Supabase — refusing to rebrand" ;;
  *"$DEV_REF"*)
    log "confirmed dev/staging Supabase ($DEV_REF)" ;;
  *)
    if [ "${SKIP_CONFIRM:-0}" = "1" ]; then
      die "unknown Supabase ref and SKIP_CONFIRM=1 — refusing to guess"
    fi
    printf '\033[1;33mUnrecognized project. Confirm this is NOT Kaufman production [y/N]: \033[0m'
    read -r answer < /dev/tty
    case "$answer" in y|Y|yes|YES) ;; *) die "aborted" ;; esac ;;
esac

# --- 1. brand env upsert -----------------------------------------------------
upsert() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
  log "set ${key}=${value}"
}
upsert NEXT_PUBLIC_BRAND perlstein
upsert NEXT_PUBLIC_APP_NAME "פרלשטיין משכנתאות"

# --- 2. deploy the branch ----------------------------------------------------
docker rm -f first-crm_test 2>/dev/null || true   # leftover from an aborted run
log "fetching official deploy script from main"
curl -fsSL "$DEPLOY_SRC" -o "$DEPLOY_SCRIPT"
log "deploying branch ${BRANCH} (SKIP_MIGRATIONS=1 — branch adds no migrations)"
SKIP_MIGRATIONS=1 DEPLOY_BRANCH="$BRANCH" bash "$DEPLOY_SCRIPT"

# --- 3. verify ---------------------------------------------------------------
log "health check:"
curl -s localhost:3747/api/health || die "health endpoint unreachable"
printf '\n'
LOGIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' localhost:3747/login)"
log "/login -> HTTP ${LOGIN_CODE}"
[ "$LOGIN_CODE" = "200" ] || die "/login did not return 200"
log "done — open http://104.207.131.136:3747/login to see the Perlstein brand"
