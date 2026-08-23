/**
 * AI infrastructure — shared types (Epic 0, ai-v2-spec.md §1).
 *
 * This module is pure types/constants: safe to import from domain logic and
 * tests. The SDK itself is touched ONLY by client.ts — every other layer talks
 * in these types.
 */

/**
 * Feature keys. Single source of truth for valid features — the DB column
 * (office_settings.ai_features) deliberately has no CHECK enum so adding a
 * feature here never needs a migration.
 */
export const AI_FEATURES = [
  'doc_classification',
  'email_triage',
  'case_briefing',
  'message_drafting',
  'lead_triage',
  'nl_queries',
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

/**
 * Rollout modes (spec §0.1): off → shadow (log-only) → suggest (amber flag,
 * human click) → auto (acts alone, reversible). Features that are inherently
 * human-triggered (briefing, drafting) only distinguish off/auto.
 */
export const AI_MODES = ['off', 'shadow', 'suggest', 'auto'] as const;

export type AiMode = (typeof AI_MODES)[number];

/** Model roles — resolved to concrete model ids in models.ts. */
export type AiModelRole = 'classify-light' | 'default' | 'heavy';

/**
 * Error codes returned to callers and written to ai_usage_log.error_code.
 * Never a raw provider message (those go to server logs only).
 */
export type AiErrorCode =
  | 'not_configured' // ANTHROPIC_API_KEY unset — expected until connect day
  | 'invalid_request'
  | 'rate_limited'
  | 'overloaded'
  | 'api_error'
  | 'network'
  | 'refused' // safety classifiers declined (stop_reason: refusal)
  | 'truncated' // hit max_tokens before finishing
  | 'invalid_output'; // response failed the Zod schema

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
};

export type AiResult<T> =
  | { ok: true; data: T; usage: AiUsage }
  | { ok: false; error: AiErrorCode };

/**
 * Input content blocks — the wrapper's own narrow vocabulary so callers never
 * import the SDK. PDFs go straight to the model as documents (no OCR vendor,
 * spec §2.8); images are base64 (preprocessed: HEIC→JPEG, ≤2576px long edge).
 */
export type AiContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
      dataBase64: string;
    }
  | { type: 'pdf'; dataBase64: string };

export type AiUserMessage = {
  role: 'user';
  content: string | AiContentBlock[];
};
