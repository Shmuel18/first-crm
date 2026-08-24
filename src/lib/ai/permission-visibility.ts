import { isAiFeatureActive, type AiFeatureSettings } from './flags';

import type { AiFeature } from './types';

/**
 * AI permission keys are seeded by migration and AUTO-GRANTED to admin by
 * trg_grant_new_permission_to_admin (mig 169). With the AI flags off those
 * grants are inert — but a surface gated on the permission ALONE would still
 * render (this is exactly what leaked the smart-inbox nav item into a client's
 * production during a deliberately dark deploy).
 *
 * So: an AI permission counts as visible only while at least one feature it
 * unlocks is actually active. Pure — no I/O; the caller supplies the settings.
 */
const AI_PERMISSION_FEATURES: Record<string, readonly AiFeature[]> = {
  view_ai_inbox: ['email_triage'],
  // One key, two surfaces (pre-call briefing + message drafting).
  use_ai_assistant: ['case_briefing', 'message_drafting'],
  use_ai_queries: ['nl_queries'],
};

/** True when the key is an AI permission whose features are ALL off. */
export function isAiPermissionInert(key: string, settings: AiFeatureSettings): boolean {
  const features = AI_PERMISSION_FEATURES[key];
  if (!features) return false; // not an AI key — never our business
  return !features.some((feature) => isAiFeatureActive(settings, feature));
}

/** Drops permissions that are inert because their AI feature is off. */
export function filterInertAiPermissions<T extends { key: string }>(
  permissions: readonly T[],
  settings: AiFeatureSettings,
): T[] {
  return permissions.filter((p) => !isAiPermissionInert(p.key, settings));
}
