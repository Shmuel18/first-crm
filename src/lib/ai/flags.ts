import { z } from 'zod';

import { AI_MODES, type AiFeature, type AiMode } from './types';

/**
 * AI feature flags — pure parsing + resolution (no I/O, fully unit-tested).
 *
 * The raw value lives in office_settings.ai_features (JSONB). The shape is
 * owned HERE, not in SQL: any malformed/partial/legacy value degrades to a
 * SAFE default (that feature off), never to "enabled". `.catch()` at every
 * level means parseAiFeatures never throws and never returns garbage —
 * the kill switch fails closed (spec §0.1).
 */

const AiModeSchema = z.enum(AI_MODES).catch('off');

const AiModesSchema = z
  .object({
    doc_classification: AiModeSchema,
    email_triage: AiModeSchema,
    case_briefing: AiModeSchema,
    message_drafting: AiModeSchema,
    lead_triage: AiModeSchema,
    nl_queries: AiModeSchema,
    scheduled_digest: AiModeSchema,
  })
  .catch({
    doc_classification: 'off',
    email_triage: 'off',
    case_briefing: 'off',
    message_drafting: 'off',
    lead_triage: 'off',
    nl_queries: 'off',
    scheduled_digest: 'off',
  });

export const AiFeatureSettingsSchema = z
  .object({
    /** Master kill switch — false means every feature is off, whatever modes say. */
    enabled: z.boolean().catch(false),
    modes: AiModesSchema,
  })
  .catch({
    enabled: false,
    modes: {
      doc_classification: 'off',
      email_triage: 'off',
      case_briefing: 'off',
      message_drafting: 'off',
      lead_triage: 'off',
      nl_queries: 'off',
      scheduled_digest: 'off',
    },
  });

export type AiFeatureSettings = z.infer<typeof AiFeatureSettingsSchema>;

export const DEFAULT_AI_FEATURES: AiFeatureSettings = AiFeatureSettingsSchema.parse({});

/** Never throws: outer/inner .catch() absorbs any malformed JSONB. */
export function parseAiFeatures(raw: unknown): AiFeatureSettings {
  return AiFeatureSettingsSchema.parse(raw ?? {});
}

/** The effective mode for a feature — the kill switch overrides everything. */
export function resolveAiMode(settings: AiFeatureSettings, feature: AiFeature): AiMode {
  if (!settings.enabled) return 'off';
  return settings.modes[feature];
}

/** True when the feature should run at all (shadow counts as running). */
export function isAiFeatureActive(settings: AiFeatureSettings, feature: AiFeature): boolean {
  return resolveAiMode(settings, feature) !== 'off';
}

/** True when the feature may take visible actions (suggest or auto). */
export function isAiFeatureVisible(settings: AiFeatureSettings, feature: AiFeature): boolean {
  const mode = resolveAiMode(settings, feature);
  return mode === 'suggest' || mode === 'auto';
}
