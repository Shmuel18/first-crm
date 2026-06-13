/**
 * Where a lead came from, derived from its `metadata.source` (set by the
 * submit_public_intake RPC, migration 175). Lets the leads list tell a quick
 * website "contact us" submission apart from a full /check questionnaire.
 *
 * - 'contact'       — landing contact form (metadata.source = 'web_contact')
 * - 'questionnaire' — the /check questionnaire (metadata.source = 'public_intake')
 * - 'manual'        — created by staff in the app (no public source)
 *
 * `source` is RPC-controlled (not client-supplied), so it is a stable, robust
 * marker — unlike the old payload.form_type, which no producer ever wrote.
 */
export type LeadSource = 'contact' | 'questionnaire' | 'manual';

type LeadMetadata = {
  source?: string | null;
} | null;

export function leadSource(metadata: unknown): LeadSource {
  // `metadata` is the leads.metadata column (generated type `Json`); narrow it here.
  const m = (metadata ?? null) as LeadMetadata;
  if (m?.source === 'web_contact') return 'contact';
  if (m?.source === 'public_intake') return 'questionnaire';
  return 'manual';
}
