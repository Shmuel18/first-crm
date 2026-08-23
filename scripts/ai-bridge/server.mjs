#!/usr/bin/env node
// =============================================================================
// first-crm AI bridge — DEMO transport (ai-v2-spec.md §1.5, subscription mode)
// =============================================================================
// A tiny localhost HTTP service that runs the OFFICIAL Claude Agent SDK on a
// Max subscription, so the Perlstein demo needs no API key. The Next.js app
// (src/lib/ai/bridge.ts) POSTs here when AI_BRIDGE_URL is set; this process
// owns the subscription login (via the `claude` CLI the SDK drives).
//
// Permitted: the Agent SDK draws from the subscription pool (Anthropic paused
// the June-2026 split; verified 2026-08). This is the SDK path, NOT an OAuth
// token stuffed into a third-party tool — that remains banned.
//
// SECURITY: bind 127.0.0.1 ONLY. The optional AI_BRIDGE_TOKEN is a second
// latch, not the boundary — nothing but localhost can reach the port.
//
// Endpoints:
//   GET  /health        → { ok, ready }  (ready=false until a self-test passes)
//   POST /selftest      → runs one trivial query, proves the subscription works
//   POST /task          → { system, blocks:[{type,text|dataBase64,mediaType}],
//                           maxTokens, model } → { ok, text }   (non-stream)
//   POST /stream        → { system, prompt, maxTokens, model } → text/plain SSE-less
//
// The app folds the JSON schema into `system` and parses the text itself, so
// this service is deliberately dumb: prompt in, assistant text out.
// =============================================================================

import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

const PORT = Number(process.env.AI_BRIDGE_PORT ?? '8790');
// 127.0.0.1 by default (safest). Set AI_BRIDGE_HOST to the Docker bridge
// gateway (e.g. 172.17.0.1) so the first-crm CONTAINER can reach the bridge —
// that IP is reachable only from containers on the default bridge + the host,
// never the public internet, and the AI_BRIDGE_TOKEN is a second latch.
const HOST = process.env.AI_BRIDGE_HOST ?? '127.0.0.1';
const TOKEN = process.env.AI_BRIDGE_TOKEN ?? '';
const MAX_BODY_BYTES = 25 * 1024 * 1024; // room for a base64 PDF/scan

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Run one completion through the Agent SDK and return the final assistant text.
 * We key off the terminal `result` message — the most stable part of the SDK
 * contract — rather than internal assistant-block shapes. Tools stay OFF unless
 * a PDF block forces the Read tool (harness reads the file from a temp dir).
 */
async function runCompletion({ system, blocks, prompt, model, maxTokens, onDelta }) {
  const promptBlocks = [];
  let tempDir = null;
  const disallow = ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Task', 'Glob', 'Grep'];
  const allow = [];

  // CRITICAL: fold the system prompt IN-BAND. The Agent SDK's `systemPrompt`
  // option does NOT reliably replace Claude Code's built-in coding-agent
  // persona in this SDK version — the model answered "I help with code, not
  // mortgages" and dropped our instructions. Prepending the instructions as
  // the first user text makes them govern regardless of SDK/version quirks.
  const sys = typeof system === 'string' ? system.trim() : '';
  if (sys) {
    promptBlocks.push({
      type: 'text',
      text: `${sys}\n\n--- להלן הקלט. פעל לפי ההוראות שלמעלה בלבד. ---`,
    });
  }

  if (typeof prompt === 'string') {
    promptBlocks.push({ type: 'text', text: prompt });
  } else {
    for (const b of blocks ?? []) {
      if (b.type === 'text') {
        promptBlocks.push({ type: 'text', text: b.text });
      } else if (b.type === 'image' && IMAGE_MIME.has(b.mediaType)) {
        promptBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: b.mediaType, data: b.dataBase64 },
        });
      } else if (b.type === 'pdf') {
        // The SDK's image block is images-only; hand a PDF to the harness as a
        // file it may Read (scoped to a throwaway temp dir).
        tempDir ??= mkdtempSync(join(tmpdir(), 'aibridge-'));
        const p = join(tempDir, `doc-${promptBlocks.length}.pdf`);
        writeFileSync(p, Buffer.from(b.dataBase64, 'base64'));
        promptBlocks.push({ type: 'text', text: `קרא ונתח את קובץ ה-PDF שבנתיב: ${p}` });
        if (!allow.includes('Read')) allow.push('Read');
      }
    }
  }

  async function* input() {
    yield { type: 'user', message: { role: 'user', content: promptBlocks } };
  }

  const options = {
    model,
    maxTurns: allow.length > 0 ? 4 : 1,
    // Kept as a secondary channel; the in-band prepend above is what actually
    // governs. Explicitly load NO filesystem settings so a stray CLAUDE.md on
    // the host can't reintroduce the coding-agent persona.
    systemPrompt: system,
    settingSources: [],
    permissionMode: 'bypassPermissions',
    maxTokens,
    disallowedTools: disallow,
    ...(allow.length > 0 ? { allowedTools: allow } : { allowedTools: [] }),
    // Ask the SDK for partial messages so /stream can emit text as it's
    // generated (real typing effect). Ignored by SDK versions that don't
    // support it — we fall back to the final `result` text below.
    ...(onDelta ? { includePartialMessages: true } : {}),
  };

  let text = '';
  let streamed = 0;
  let refused = false;
  try {
    for await (const message of query({ prompt: input(), options })) {
      // Partial text deltas (shape is version-sensitive — probe defensively).
      if (onDelta && message.type === 'stream_event') {
        const ev = message.event ?? message.data ?? message;
        const delta =
          ev?.delta?.text ?? (ev?.type === 'content_block_delta' ? ev?.delta?.text : undefined);
        if (typeof delta === 'string' && delta.length > 0) {
          streamed += delta.length;
          onDelta(delta);
        }
      }
      if (message.type === 'result') {
        if (message.subtype === 'success' && typeof message.result === 'string') {
          text = message.result;
        } else if (message.subtype && message.subtype.startsWith('error')) {
          refused = message.subtype.includes('refusal');
        }
      }
    }
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }

  if (refused) return { ok: false, error: 'refused' };
  if (!text && streamed === 0) return { ok: false, error: 'api_error' };
  return { ok: true, text, streamed };
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

let ready = false;

function unauthorized(req) {
  if (!TOKEN) return false;
  const h = req.headers.authorization ?? '';
  return h !== `Bearer ${TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, ready });
    }
    if (unauthorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });

    if (req.method === 'POST' && req.url === '/selftest') {
      const out = await runCompletion({
        system: 'Reply with exactly the word OK and nothing else.',
        prompt: 'ping',
        model: 'claude-haiku-4-5',
        maxTokens: 16,
      });
      ready = out.ok;
      return json(res, out.ok ? 200 : 500, out);
    }

    if (req.method === 'POST' && req.url === '/task') {
      const { system, blocks, model, maxTokens } = JSON.parse(await readBody(req));
      const out = await runCompletion({ system, blocks, model, maxTokens: maxTokens ?? 2048 });
      return json(res, out.ok ? 200 : 502, out);
    }

    if (req.method === 'POST' && req.url === '/stream') {
      const { system, prompt, model, maxTokens } = JSON.parse(await readBody(req));
      // Stream text as the model generates it (typing effect). Headers are
      // written lazily on the first delta so a pre-output error can still be a
      // clean JSON 502. If the SDK version yields no partials, we write the
      // final buffered text in one chunk (graceful fallback).
      const ensureHead = () => {
        if (!res.headersSent) {
          res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
          });
        }
      };
      const out = await runCompletion({
        system,
        prompt,
        model,
        maxTokens: maxTokens ?? 1500,
        onDelta: (t) => {
          ensureHead();
          res.write(t);
        },
      });
      if (!out.ok) {
        if (!res.headersSent) return json(res, 502, out);
        return res.end(); // already streaming — just close
      }
      ensureHead();
      // Buffered fallback: nothing streamed → write the whole text now.
      res.end(out.streamed > 0 ? '' : out.text);
      return;
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    console.error('[ai-bridge] request failed', err);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'api_error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[ai-bridge] listening on http://${HOST}:${PORT} (token ${TOKEN ? 'on' : 'off'})`);
  console.log('[ai-bridge] run POST /selftest once to confirm the subscription login works');
});
