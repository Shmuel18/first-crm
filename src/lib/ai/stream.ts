import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';

import { bridgeStream } from './bridge';
import { AI_MODELS } from './models';
import { logAiUsage } from './usage-log';

import type { AiErrorCode, AiFeature, AiModelRole } from './types';

/**
 * Streaming free-text sibling of runAiTask (ai-v2-spec.md §7.3: every textual
 * deliverable streams). Same discipline: this file and client.ts are the only
 * SDK touchpoints, telemetry on every call, provider errors stay server-side.
 * Used by the briefing/drafting routes; structured pipelines keep runAiTask.
 */

export type StreamAiTextInput = {
  feature: AiFeature;
  role?: AiModelRole;
  system: string;
  prompt: string;
  maxTokens?: number;
  caseId?: string;
  createdBy?: string;
};

export type StreamAiTextResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; error: AiErrorCode };

let sdk: Anthropic | null = null;

function getSdk(apiKey: string): Anthropic {
  sdk ??= new Anthropic({ apiKey });
  return sdk;
}

export async function streamAiText(input: StreamAiTextInput): Promise<StreamAiTextResult> {
  const started = Date.now();
  const model = AI_MODELS[input.role ?? 'default'];
  const encoder = new TextEncoder();

  // Bridge transport (demo, subscription-backed): proxy the bridge's text
  // stream straight through. Usage tokens are unknown over the bridge; log a
  // single ok row when the stream is handed off (the API path logs richer
  // token detail on completion).
  if (env.AI_BRIDGE_URL) {
    const bridged = await bridgeStream({
      system: input.system,
      prompt: input.prompt,
      maxTokens: input.maxTokens ?? 1500,
      model,
    });
    if (!bridged.ok) {
      void logAiUsage({
        feature: input.feature,
        model,
        ok: false,
        errorCode: bridged.error,
        latencyMs: Date.now() - started,
        caseId: input.caseId,
        createdBy: input.createdBy,
      });
      return bridged;
    }
    void logAiUsage({
      feature: input.feature,
      model,
      ok: true,
      latencyMs: Date.now() - started,
      caseId: input.caseId,
      createdBy: input.createdBy,
    });
    return { ok: true, stream: bridged.stream };
  }

  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'not_configured' };

  const messageStream = getSdk(env.ANTHROPIC_API_KEY).messages.stream({
    model,
    max_tokens: input.maxTokens ?? 1500,
    system: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: input.prompt }],
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      messageStream.on('text', (delta) => controller.enqueue(encoder.encode(delta)));
      messageStream.on('error', (err) => {
        console.error(`[ai] ${input.feature} stream failed`, err);
        void logAiUsage({
          feature: input.feature,
          model,
          ok: false,
          errorCode: 'api_error',
          latencyMs: Date.now() - started,
          caseId: input.caseId,
          createdBy: input.createdBy,
        });
        controller.error(err);
      });
      void messageStream
        .finalMessage()
        .then(async (final) => {
          await logAiUsage({
            feature: input.feature,
            model,
            ok: final.stop_reason !== 'refusal',
            errorCode: final.stop_reason === 'refusal' ? 'refused' : undefined,
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
            cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
            latencyMs: Date.now() - started,
            caseId: input.caseId,
            createdBy: input.createdBy,
          });
          controller.close();
        })
        .catch(() => {
          /* the 'error' handler above already reported */
        });
    },
    cancel() {
      messageStream.abort();
    },
  });

  return { ok: true, stream };
}
