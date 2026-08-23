import type { AiModelRole } from './types';

/**
 * Role → concrete model id (ai-v2-spec.md §1.2). Swapping a model is a config
 * change here — zero changes in calling code. Chosen in the spec:
 *  - classify-light: bulk/cheap triage (email stage-1, lead heat)
 *  - default:        document reading, classification, briefings, drafting
 *  - heavy:          second pass on hard scans that fell below the
 *                    confidence threshold
 */
export const AI_MODELS: Record<AiModelRole, string> = {
  'classify-light': 'claude-haiku-4-5',
  default: 'claude-sonnet-5',
  heavy: 'claude-opus-5',
};

/**
 * Default output budget. Classification/triage outputs are small JSON; callers
 * with longer outputs (briefings, drafts) pass their own maxTokens.
 */
export const AI_MAX_TOKENS_DEFAULT = 2048;
