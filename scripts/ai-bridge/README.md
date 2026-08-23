# first-crm AI bridge — subscription transport (DEMO)

Runs the official **Claude Agent SDK** on a Max subscription so the Perlstein
demo drives the AI features **without an API key**. The Next.js app talks to it
over `127.0.0.1` when `AI_BRIDGE_URL` is set (see `src/lib/ai/bridge.ts`).

**Why this is allowed:** the Agent SDK draws from the subscription pool
(Anthropic paused the June-2026 split; the ban is specifically on stuffing an
OAuth token into a third-party tool, which this is not). It is a demo bridge —
when Perlstein buys, they get their own API key and this bridge is retired.

**Trade-offs vs an API key** (know these before demoing): no native Structured
Outputs (the app folds the schema into the prompt and parses — slightly less
robust), a few seconds slower per call, low concurrency, and it competes with
the same subscription window your Claude Code uses. For a live 1:1 demo that's
fine; for production, use a key.

---

## One-time setup on the demo host (you run these — they use YOUR login)

```bash
ssh root@104.207.131.136

# 1. Claude CLI + subscription login (the SDK drives this binary).
#    If `claude` is already installed and logged in, skip to step 2.
npm install -g @anthropic-ai/claude-code
claude login            # opens a device-code flow — log in with your Max account
claude -p "say ok"      # confirms the subscription answers

# 2. Install the bridge (pulls the Agent SDK).
mkdir -p /opt/ai-bridge
# copy scripts/ai-bridge/{package.json,server.mjs} here (scp or git),
cd /opt/ai-bridge && npm install --omit=dev

# 3. Pick a shared token (second latch; the real guard is localhost-only).
export BRIDGE_TOKEN="$(openssl rand -base64 24)"
echo "token: $BRIDGE_TOKEN"   # you'll paste this into the app env in step 5

# 4. Run it as a service (survives reboots + logout).
cat >/etc/systemd/system/first-crm-ai-bridge.service <<EOF
[Unit]
Description=first-crm AI bridge (Claude Agent SDK, subscription)
After=network.target

[Service]
Environment=AI_BRIDGE_PORT=8790
Environment=AI_BRIDGE_TOKEN=${BRIDGE_TOKEN}
# The SDK reads the CLI login from this HOME — must match where you ran `claude login`.
Environment=HOME=/root
WorkingDirectory=/opt/ai-bridge
ExecStart=/usr/bin/node /opt/ai-bridge/server.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now first-crm-ai-bridge

# 5. Prove the subscription actually answers through the bridge:
curl -fsS -X POST http://127.0.0.1:8790/selftest \
  -H "Authorization: Bearer $BRIDGE_TOKEN" | head
# expect: {"ok":true,"text":"OK"}

# 6. Point the app at the bridge and restart the container (env is read at
#    container CREATE, so a plain restart won't pick it up — recreate).
printf 'AI_BRIDGE_URL=http://127.0.0.1:8790\nAI_BRIDGE_TOKEN=%s\n' "$BRIDGE_TOKEN" \
  >> /opt/first-crm/.env.production
# NOTE: the container is on the default bridge network; if 127.0.0.1 inside the
# container can't reach the host, use --network host for first-crm OR set
# AI_BRIDGE_URL to the host's docker0 IP (172.17.0.1). See "Networking" below.
```

Then tell me it's up — I'll recreate the `first-crm` container, turn on the
feature flags, grant the `use_ai_*` permissions to the demo roles, and run a
live classification.

## Networking (container → host)

The app runs in Docker; the bridge runs on the host. Three options, easiest first:

- **`AI_BRIDGE_URL=http://172.17.0.1:8790`** — the host's `docker0` gateway IP,
  reachable from the default bridge network. Bind the bridge to `0.0.0.0` only
  if you also firewall the port; otherwise keep it on `127.0.0.1` and use the
  host-gateway option your Docker version supports.
- Run first-crm with `--add-host=host.docker.internal:host-gateway` and use
  `http://host.docker.internal:8790`.
- Run first-crm with `--network host` and keep `http://127.0.0.1:8790`.

I'll wire whichever you pick when I recreate the container.

## Rollback

Remove the two `AI_BRIDGE_*` lines from `/opt/first-crm/.env.production` and
recreate the container — the app falls straight back to the API-key path (or to
"not configured" if no key is set). `systemctl disable --now
first-crm-ai-bridge` stops the bridge.
