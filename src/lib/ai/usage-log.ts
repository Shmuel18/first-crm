import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

import type { AiErrorCode } from './types';

export type AiUsageLogEntry = {
  feature: string;
  model: string;
  ok: boolean;
  errorCode?: AiErrorCode;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs: number;
  caseId?: string;
  createdBy?: string;
};

/**
 * Append one telemetry row (cost panel + accuracy reviews). Service-role
 * client on purpose — ai_usage_log has no INSERT policy, so a user JWT can
 * never write telemetry. NEVER throws and NEVER logs content: a telemetry
 * failure must not fail the task it measures (spec §1.3).
 */
export async function logAiUsage(entry: AiUsageLogEntry): Promise<void> {
  try {
    const db = createAdminClient();
    const { error } = await db.from('ai_usage_log').insert({
      feature: entry.feature,
      model: entry.model,
      ok: entry.ok,
      error_code: entry.errorCode ?? null,
      input_tokens: entry.inputTokens ?? 0,
      output_tokens: entry.outputTokens ?? 0,
      cache_read_tokens: entry.cacheReadTokens ?? 0,
      cache_write_tokens: entry.cacheWriteTokens ?? 0,
      latency_ms: Math.max(0, Math.round(entry.latencyMs)),
      case_id: entry.caseId ?? null,
      created_by: entry.createdBy ?? null,
    });
    if (error) console.error('[ai] usage-log insert failed', error);
  } catch (err) {
    console.error('[ai] usage-log insert threw', err);
  }
}
