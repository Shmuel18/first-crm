import type { AiMode } from '@/lib/ai/types';

/**
 * Threshold policy for document classification (ai-v2-spec.md §2.3).
 * Pure functions — the whole decision tree is unit-tested with no I/O.
 *
 * Calibration note: the numbers are the spec's starting points; shadow-mode
 * runs against real documents are what tune them (spec §2.7).
 */

export const AUTO_MIN_CONFIDENCE = 0.85;
export const SUGGEST_MIN_CONFIDENCE = 0.6;

export type ClassificationDecision =
  | 'shadow' // logged only (mode=shadow)
  | 'auto' // apply category automatically
  | 'suggested' // amber suggestion, advisor clicks
  | 'needs_review' // too uncertain — stays uncategorized, exceptions queue
  | 'validated'; // human already categorized — flags only, never override

export type ClassificationDecisionInput = {
  mode: AiMode;
  confidence: number;
  /** The model's proposed type key ('unknown' when it can't tell). */
  docTypeKey: string;
  /** True when the document already carries a human-chosen category. */
  hasHumanCategory: boolean;
};

/**
 * The one place that decides what the pipeline DOES with a model answer.
 * Order matters: human category wins over everything (spec §0.2), then
 * uncertainty, then rollout mode.
 */
export function decideClassification(input: ClassificationDecisionInput): ClassificationDecision {
  if (input.hasHumanCategory) return input.mode === 'shadow' ? 'shadow' : 'validated';
  if (input.docTypeKey === 'unknown' || input.confidence < SUGGEST_MIN_CONFIDENCE) {
    return input.mode === 'shadow' ? 'shadow' : 'needs_review';
  }
  if (input.mode === 'shadow') return 'shadow';
  if (input.mode === 'auto' && input.confidence >= AUTO_MIN_CONFIDENCE) return 'auto';
  return 'suggested';
}

/**
 * A low-confidence first pass earns ONE retry on the heavy model before
 * falling into the manual queue (spec §2.3). Shadow mode skips the retry —
 * calibration wants the cheap model's raw performance.
 */
export function needsHeavyRetry(mode: AiMode, confidence: number): boolean {
  return mode !== 'shadow' && confidence < SUGGEST_MIN_CONFIDENCE;
}
