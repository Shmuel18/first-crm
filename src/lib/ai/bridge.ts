import 'server-only';

import { env } from '@/lib/env';

import { stripJsonFence, withSchemaInstruction } from './bridge-format';

import type { AiContentBlock, AiErrorCode, AiUserMessage } from './types';

export { stripJsonFence, withSchemaInstruction };

/**
 * Client side of the AI bridge (DEMO transport). The bridge is a localhost
 * service on the demo host that runs the official Claude Agent SDK on a Max
 * subscription — so the demo needs no API key. This module is the ONLY thing
 * in the app that talks to it; client.ts / stream.ts delegate here when
 * AI_BRIDGE_URL is set.
 *
 * The bridge has no native Structured Outputs, so runAiTask embeds the JSON
 * schema as a system-prompt instruction and parses the text reply (the same
 * parse+Zod-validate the API path already does). Everything else — telemetry,
 * error mapping, fail-soft — stays in the callers.
 */

export type BridgeBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; dataBase64: string }
  | { type: 'pdf'; dataBase64: string };

function toBridgeBlocks(content: string | AiContentBlock[]): BridgeBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return content.map((b) =>
    b.type === 'image'
      ? { type: 'image', mediaType: b.mediaType, dataBase64: b.dataBase64 }
      : b.type === 'pdf'
        ? { type: 'pdf', dataBase64: b.dataBase64 }
        : { type: 'text', text: b.text },
  );
}

export type BridgeTaskResult =
  | { ok: true; text: string }
  | { ok: false; error: AiErrorCode };

/** Non-streaming completion — returns raw text for the caller to parse/validate. */
export async function bridgeTask(input: {
  system: string;
  messages: AiUserMessage[];
  maxTokens: number;
  model: string;
}): Promise<BridgeTaskResult> {
  if (!env.AI_BRIDGE_URL) return { ok: false, error: 'not_configured' };
  try {
    const res = await bridgeFetch('/task', {
      system: input.system,
      maxTokens: input.maxTokens,
      model: input.model,
      blocks: toBridgeBlocks(input.messages[0]?.content ?? ''),
    });
    if (!res.ok) {
      console.error('[ai-bridge] task HTTP', res.status);
      return { ok: false, error: res.status === 429 ? 'rate_limited' : 'api_error' };
    }
    const body = (await res.json()) as { ok?: boolean; text?: string; error?: string };
    if (!body.ok || typeof body.text !== 'string') {
      return { ok: false, error: mapBridgeError(body.error) };
    }
    return { ok: true, text: body.text };
  } catch (err) {
    console.error('[ai-bridge] task failed', err);
    return { ok: false, error: 'network' };
  }
}

export type BridgeStreamResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; error: AiErrorCode };

/** Streaming text — proxies the bridge's plain-text stream straight through. */
export async function bridgeStream(input: {
  system: string;
  prompt: string;
  maxTokens: number;
  model: string;
}): Promise<BridgeStreamResult> {
  if (!env.AI_BRIDGE_URL) return { ok: false, error: 'not_configured' };
  try {
    const res = await bridgeFetch('/stream', {
      system: input.system,
      prompt: input.prompt,
      maxTokens: input.maxTokens,
      model: input.model,
    });
    if (!res.ok || !res.body) {
      console.error('[ai-bridge] stream HTTP', res.status);
      return { ok: false, error: res.status === 429 ? 'rate_limited' : 'api_error' };
    }
    return { ok: true, stream: res.body };
  } catch (err) {
    console.error('[ai-bridge] stream failed', err);
    return { ok: false, error: 'network' };
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.AI_BRIDGE_TOKEN) headers.Authorization = `Bearer ${env.AI_BRIDGE_TOKEN}`;
  return headers;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * POST to the bridge with ONE retry on a transient failure (5xx, or a network
 * error / timeout). The bridge spawns a CLI child per request on a shared,
 * low-concurrency subscription, so a single call can 502 under overlap — a
 * quick retry recovers it. Safe for the streaming path too: this runs BEFORE
 * any byte is read, and every bridge call is a side-effect-free text
 * completion. A 429 is never retried (respect the rate limit).
 */
async function bridgeFetch(path: string, body: unknown): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`${env.AI_BRIDGE_URL}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status >= 500 && attempt === 0) {
        await res.body?.cancel();
        lastErr = new Error(`bridge ${res.status}`);
        await delay(400);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await delay(400);
    }
  }
  throw lastErr ?? new Error('bridge unreachable');
}

function mapBridgeError(code: string | undefined): AiErrorCode {
  switch (code) {
    case 'refused':
      return 'refused';
    case 'rate_limited':
      return 'rate_limited';
    case 'truncated':
      return 'truncated';
    default:
      return 'api_error';
  }
}
