#!/usr/bin/env bash
# =============================================================================
# Install the first-crm host cron scheduler (Vultr / Docker deploy).
# =============================================================================
# The app's scheduled jobs are declared in vercel.json, but those only fire on
# Vercel's platform. Production runs as a Docker container on :3747, so on this
# host NOTHING triggers /api/cron/* — the nightly backup, blob cleanup, SLA
# check, and task reminders silently never run. This installs a host scheduler
# (/etc/cron.d/first-crm) that curls each endpoint with the bearer secret on the
# same schedule as vercel.json.
#
#   Run as root ON THE SERVER (idempotent — safe to re-run):
#     curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/cron/install-first-crm-cron.sh | bash
#   or:  scp this file to the host and `bash install-first-crm-cron.sh`
#
# Design notes:
#   * CRON_SECRET is read LIVE from .env.production at call time by the wrapper,
#     so the secret never lands in git or in the crontab.
#   * Schedules are interpreted as UTC (CRON_TZ) to match Vercel Cron exactly.
#   * Failure visibility today = /var/log/first-crm-cron.log (HTTP code + body)
#     + non-zero exit. Push alerting on backup failure / a "backup older than
#     26h" sentinel is a separate app-level follow-up (needs Resend) — NOT here.
# =============================================================================
set -euo pipefail

ENV_FILE="/opt/first-crm/.env.production"
WRAPPER="/usr/local/bin/first-crm-cron.sh"
CRONFILE="/etc/cron.d/first-crm"
PORT="3747"

[ "$(id -u)" = 0 ] || { echo "✖ must run as root" >&2; exit 1; }
command -v curl >/dev/null || { echo "✖ curl not found" >&2; exit 1; }
[ -f "$ENV_FILE" ]       || { echo "✖ $ENV_FILE not found" >&2; exit 1; }
grep -qE '^CRON_SECRET=' "$ENV_FILE" \
  || { echo "✖ CRON_SECRET missing from $ENV_FILE — the app needs it too; add it first" >&2; exit 1; }

# --- wrapper: fires one endpoint, reads the secret live, logs the result ------
cat > "$WRAPPER" <<'WRAP'
#!/usr/bin/env bash
# Fires ONE first-crm internal cron endpoint. CRON_SECRET is read live from
# .env.production, so it is never stored in git or in the crontab.
# Usage: first-crm-cron.sh <endpoint>      e.g. first-crm-cron.sh backup
# Installed by scripts/cron/install-first-crm-cron.sh — do not hand-edit.
set -uo pipefail
ENDPOINT="${1:?usage: first-crm-cron.sh <endpoint>}"
ENV_FILE="/opt/first-crm/.env.production"
PORT="3747"
LOG="/var/log/first-crm-cron.log"
ts() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)"
SECRET="${SECRET%$'\r'}"; SECRET="${SECRET%\"}"; SECRET="${SECRET#\"}"; SECRET="${SECRET%\'}"; SECRET="${SECRET#\'}"
if [ -z "$SECRET" ]; then
  echo "$(ts) [$ENDPOINT] ERROR CRON_SECRET missing from $ENV_FILE" >> "$LOG"
  exit 1
fi

OUT="$(mktemp)"
CODE="$(curl -sS -o "$OUT" -w '%{http_code}' --max-time 300 \
  -H "Authorization: Bearer $SECRET" "http://localhost:$PORT/api/cron/$ENDPOINT" 2>>"$LOG" || echo 000)"
BODY="$(tr -d '\r\n' < "$OUT" | head -c 300)"
rm -f "$OUT"
echo "$(ts) [$ENDPOINT] HTTP $CODE $BODY" >> "$LOG"
[ "$CODE" = 200 ] || exit 1
# A 200 with {"ok":false} (e.g. backup skipped: drive_not_connected) means the
# job did NOT do its work — surface it as a failed run, not silently green.
case "${BODY// /}" in *'"ok":true'*) exit 0 ;; *) exit 1 ;; esac
WRAP
chmod 0755 "$WRAPPER"

# --- schedule: mirrors vercel.json, UTC ---------------------------------------
cat > "$CRONFILE" <<'CRONEOF'
# first-crm internal crons — host scheduler. The app runs in Docker on :3747,
# so vercel.json's Vercel-Cron schedules do not fire here. Mirrors vercel.json.
# Managed by scripts/cron/install-first-crm-cron.sh — do not hand-edit.
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
CRON_TZ=UTC
MAILTO=""

0 2 * * *    root /usr/local/bin/first-crm-cron.sh backup
30 3 * * *   root /usr/local/bin/first-crm-cron.sh cleanup-orphaned-blobs
0 5 * * *    root /usr/local/bin/first-crm-cron.sh status-sla-check
*/15 * * * * root /usr/local/bin/first-crm-cron.sh task-reminders
CRONEOF
chmod 0644 "$CRONFILE"

# Nudge cron to re-scan (/etc/cron.d is auto-scanned; this is belt-and-suspenders)
systemctl reload cron 2>/dev/null || systemctl reload crond 2>/dev/null || service cron reload 2>/dev/null || true

echo "✓ installed $WRAPPER"
echo "✓ installed $CRONFILE (UTC; backup 02:00, cleanup 03:30, sla 05:00, reminders */15m)"
echo "  test now:   $WRAPPER backup   &&  tail -n 3 /var/log/first-crm-cron.log"
