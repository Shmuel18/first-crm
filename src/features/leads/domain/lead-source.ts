/**
 * Where a lead came from, derived from its `metadata`. Lets the leads list tell
 * a quick website "contact us" submission apart from a full /check questionnaire.
 *
 * - 'contact'       — landing contact form (payload carries form_type: 'contact')
 * - 'questionnaire' — the /check questionnaire (metadata.source = 'public_intake')
 * - 'manual'        — created by staff in the app (no public source)
 */
export type LeadSource = 'contact' | 'questionnaire' | 'manual';

type LeadMetadata = {
  source?: string | null;
  payload?: { form_type?: string | null } | null;
} | null;

export function leadSource(metadata: unknown): LeadSource {
  // `metadata` is the leads.metadata column (generated type `Json`); narrow it here.
  const m = (metadata ?? null) as LeadMetadata;
  if (m?.payload?.form_type === 'contact') return 'contact';
  if (m?.source === 'public_intake') return 'questionnaire';
  return 'manual';
}
