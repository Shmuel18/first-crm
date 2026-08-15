#!/usr/bin/env bash
# Rebrand the DEMO host to Perlstein and deploy the white-label branch.
#
# Runs ON the demo Vultr host (not locally). One-liner from your machine:
#
#   ssh -t root@104.207.131.136 "curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/claude/kupman-system-perlstein-adapt-1f7u5f/scripts/rebrand-demo-perlstein.sh | bash"
#
# What it does:
#   0. Shows which Supabase project the demo points at and asks you to
#      confirm it is NOT Kaufman production (branding writes nothing to the
#      DB, but a shared DB means the demo shows real data — stop and split).
#   1. Upserts NEXT_PUBLIC_BRAND=perlstein + NEXT_PUBLIC_APP_NAME into the
#      preserved .env.production.
#   2. Runs the standard deploy script from the white-label branch
#      (SKIP_MIGRATIONS=1 — the branch adds no migrations). main is not
#      touched; Kaufman production is unaffected.
#   3. Health-checks the swapped container.
#
# Revert: set NEXT_PUBLIC_BRAND=kaufman in .env.production and rerun
#   SKIP_MIGRATIONS=1 bash /opt/deploy-first-crm.sh
#
# SKIP_CONFIRM=1 skips the interactive step-0 gate (for non-tty runs).
set -euo pipefail

BRANCH="claude/kupman-system-perlstein-adapt-1f7u5f"
ENV_FILE="/opt/first-crm/.env.production"
DEPLOY_SCRIPT="/opt/deploy-first-crm.sh"
RAW_BASE="https://raw.githubusercontent.com/Shmuel18/first-crm/${BRANCH}"

log() { printf '\033[1;34m[rebrand]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[rebrand] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found — is this the demo host?"

# --- 0. DB sanity gate -------------------------------------------------------
SUPA_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
log "Demo Supabase project: ${SUPA_URL:-<missing>}"
if [ "${SKIP_CONFIRM:-0}" != "1" ]; then
  printf '\033[1;33mConfirm this is the DEMO Supabase project (NOT Kaufman production) [y/N]: \033[0m'
  read -r answer < /dev/tty
  case "$answer" in
    y|Y|yes|YES) ;;
    *) die "aborted — verify the demo DB before rebranding" ;;
  esac
fi

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
if [ ! -f "$DEPLOY_SCRIPT" ]; then
  log "deploy script missing — fetching from the branch"
  curl -fsSL "${RAW_BASE}/scripts/deploy.sh" -o "$DEPLOY_SCRIPT"
fi
log "deploying branch ${BRANCH} (migrations skipped — none added)"
SKIP_MIGRATIONS=1 DEPLOY_BRANCH="$BRANCH" bash "$DEPLOY_SCRIPT"

# --- 3. verify ---------------------------------------------------------------
log "health check:"
curl -s localhost:3747/api/health || die "health endpoint unreachable"
printf '\n'
log "done — open http://$(hostname -I | awk '{print $1}'):3747/login to see the Perlstein brand"
