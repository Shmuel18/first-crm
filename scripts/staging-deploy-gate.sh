#!/usr/bin/env bash
# SSH forced-command gate for the staging-deploy key. Install ON the staging
# host as /opt/staging-deploy-gate.sh (chmod 755), then bind the deploy key
# in /root/.ssh/authorized_keys with:
#
#   command="/opt/staging-deploy-gate.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 <PUBKEY> staging-deploy
#
# Whatever command the client asks for lands in SSH_ORIGINAL_COMMAND; only
# the two whitelisted deploy flows below ever execute. The key can deploy
# staging — nothing else on this shared host.
set -euo pipefail

RAW="https://raw.githubusercontent.com/Shmuel18/first-crm"
BRANCH="claude/kupman-system-perlstein-adapt-1f7u5f"

case "${SSH_ORIGINAL_COMMAND:-}" in
  *rebrand-demo-perlstein.sh*)
    curl -fsSL "$RAW/$BRANCH/scripts/rebrand-demo-perlstein.sh" | SKIP_CONFIRM=1 bash
    ;;
  *deploy-first-crm.sh*|*deploy.sh*)
    docker rm -f first-crm_test 2>/dev/null || true
    curl -fsSL "$RAW/main/scripts/deploy.sh" -o /opt/deploy-first-crm.sh
    SKIP_MIGRATIONS=1 bash /opt/deploy-first-crm.sh
    ;;
  *)
    logger -t staging-deploy-gate "denied: ${SSH_ORIGINAL_COMMAND:-<empty>}"
    echo "staging-deploy-gate: command not allowed" >&2
    exit 126
    ;;
esac
