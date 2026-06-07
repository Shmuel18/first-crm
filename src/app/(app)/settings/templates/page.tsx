import { redirect } from 'next/navigation';

/**
 * Templates is hidden until a consumer exists (deferred to Phase 2 —
 * "Communications" in CLAUDE.md). The feature is fully built — admin CRUD via
 * TemplatesManager + templates.service over the message_templates table — but
 * NO send path reads a template, so the management UI promised behavior that
 * isn't wired (the "variables replaced at send time" subtitle has no engine
 * behind it). Rather than ship a dead-end, the route redirects away while the
 * components, actions and table stay dormant in the repo.
 *
 * To re-enable: restore the TemplatesManager render here, re-add the nav item
 * in ../layout.tsx, and wire a template-picker (with merge-field substitution)
 * into send-client-message-button / send-doc-request-button + the email body
 * in send-document-request.ts.
 */
export default function TemplatesSettingsPage(): never {
  redirect('/settings/profile');
}
