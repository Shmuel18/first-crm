import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

import { env } from '@/lib/env';

import { toStructuredOutputSchema } from './json-schema';
import { AI_MAX_TOKENS_DEFAULT, AI_MODELS } from './models';
import { logAiUsage } from './usage-log';

import type {
  AiContentBlock,
  AiErrorCode,
  AiFeature,
  AiModelRole,
  AiResult,
  AiUsage,
  AiUserMessage,
} from './types';

/**
 * The ONLY module that touches the Anthropic SDK (ai-v2-spec.md §1.1).
 * Every call: Structured Outputs against a Zod schema, typed error mapping,
 * telemetry row in ai_usage_log (never content), prompt-cached system block.
 *
 * Callers NEVER give the model tools or DB access — the output is a closed
 * JSON schema and the calling code decides what to do with it (§8.3).
 */

export type RunAiTaskInput<T> = {
  feature: AiFeature;
  /** Model role from models.ts — defaults to 'default' (Sonnet). */
  role?: AiModelRole;
  /** Stable instructions — cached (10% read price) unless cacheSystem=false. */
  system: string;
  cacheSystem?: boolean;
  messages: AiUserMessage[];
  /** Zod schema: constrains the model AND validates the response. Use .nullable(), not .optional(). */
  schema: z.ZodType<T>;
  maxTokens?: number;
  /** Telemetry attribution only — never sent to the model. */
  caseId?: string;
  createdBy?: string;
};

let sdk: Anthropic | null = null;

function getSdk(apiKey: string): Anthropic {
  sdk ??= new Anthropic({ apiKey });
  return sdk;
}

function toSdkContent(content: string | AiContentBlock[]): string | Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') return content;
  return content.map((block): Anthropic.ContentBlockParam => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text };
      case 'image':
        return {
          type: 'image',
          source: { type: 'base64', media_type: block.mediaType, data: block.dataBase64 },
        };
      case 'pdf':
        return {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: block.dataBase64 },
        };
    }
  });
}

function mapSdkError(err: unknown): AiErrorCode {
  if (err instanceof Anthropic.APIConnectionError) return 'network';
  if (err instanceof Anthropic.RateLimitError) return 'rate_limited';
  if (err instanceof Anthropic.BadRequestError) return 'invalid_request';
  if (err instanceof Anthropic.APIError) {
    return err.error && typeof err.error === 'object' && 'type' in err.error &&
      (err.error as { type?: string }).type === 'overloaded_error'
      ? 'overloaded'
      : 'api_error';
  }
  return 'api_error';
}

export async function runAiTask<T>(input: RunAiTaskInput<T>): Promise<AiResult<T>> {
  const started = Date.now();
  const model = AI_MODELS[input.role ?? 'default'];

  const fail = async (error: AiErrorCode, usage?: Partial<AiUsage>): Promise<AiResult<T>> => {
    await logAiUsage({
      feature: input.feature,
      model,
      ok: false,
      errorCode: error,
      latencyMs: Date.now() - started,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      cacheReadTokens: usage?.cacheReadTokens,
      cacheWriteTokens: usage?.cacheWriteTokens,
      caseId: input.caseId,
      createdBy: input.createdBy,
    });
    return { ok: false, error };
  };

  if (!env.ANTHROPIC_API_KEY) return fail('not_configured');

  let response: Anthropic.Message;
  try {
    response = await getSdk(env.ANTHROPIC_API_KEY).messages.create({
      model,
      max_tokens: input.maxTokens ?? AI_MAX_TOKENS_DEFAULT,
      system: [
        {
          type: 'text',
          text: input.system,
          ...(input.cacheSystem === false ? {} : { cache_control: { type: 'ephemeral' as const } }),
        },
      ],
      messages: input.messages.map((m) => ({ role: m.role, content: toSdkContent(m.content) })),
      output_config: {
        format: {
          type: 'json_schema',
          schema: toStructuredOutputSchema(input.schema),
        },
      },
    });
  } catch (err) {
    // Server-side only — provider messages never reach the client (CLAUDE.md).
    console.error(`[ai] ${input.feature} request failed`, err);
    return fail(mapSdkError(err));
  }

  const usage: AiUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    latencyMs: Date.now() - started,
  };

  if (response.stop_reason === 'refusal') return fail('refused', usage);
  if (response.stop_reason === 'max_tokens') return fail('truncated', usage);

  const text = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )?.text;
  if (!text) return fail('invalid_output', usage);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return fail('invalid_output', usage);
  }

  const parsed = input.schema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error(`[ai] ${input.feature} output failed schema validation`, parsed.error.issues);
    return fail('invalid_output', usage);
  }

  await logAiUsage({
    feature: input.feature,
    model,
    ok: true,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    latencyMs: usage.latencyMs,
    caseId: input.caseId,
    createdBy: input.createdBy,
  });
  return { ok: true, data: parsed.data, usage };
}
