import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

import type { ClientEmailKind, ClientEmailLogRow } from '../types';

// Newest-first cap so the feed payload stays bounded on long-lived cases.
const MAX_EMAILS = 100;

type EmailJoinRow = ClientEmailLogRow & {
  sender: { first_name: string | null; last_name: string | null } | null;
};

export type ClientEmailLogEntry = { row: ClientEmailLogRow; senderName: string | null };

/**
 * Client-facing emails logged for a case, newest first, with the sender's
 * display name resolved. RLS scopes reads to can_view_case. Returns [] when
 * the table doesn't exist yet (migration 163 not applied) so the activity
 * feed degrades gracefully instead of crashing the history page.
 */
export async function listClientEmailLog(caseId: string): Promise<ClientEmailLogEntry[]> {
  const supabase = await createClient();
  // `client_email_log` (migration 163) isn't in the generated Database types
  // until they're regenerated post-migration — use an untyped handle and shape
  // the result through EmailJoinRow. Remove the cast after the next types gen.
  const db = supabase as unknown as SupabaseClient;

  const { data, error } = await db
    .from('client_email_log')
    .select(
      'id, case_id, kind, recipient_email, subject, body, sent_by, created_at, sender:profiles!client_email_log_sent_by_fkey(first_name, last_name)',
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(MAX_EMAILS);
  if (error) {
    console.error('[client-email-log] list failed (migration 163 applied?)', error.code);
    return [];
  }

  // PostgREST types a to-one embed as an array on the untyped client; at
  // runtime sent_by→profiles is to-one (object|null). Cast through unknown,
  // same as case-comments.service.
  const rows = (data ?? []) as unknown as EmailJoinRow[];
  return rows.map(({ sender, ...row }) => ({
    row,
    senderName: formatPersonName(sender?.first_name, sender?.last_name) || null,
  }));
}

export type LogClientEmailInput = {
  caseId: string;
  kind: ClientEmailKind;
  recipient: string;
  subject: string;
  body: string;
};

/**
 * Best-effort write after a successful send — the email already went out, so
 * a logging failure must never fail the action (it's reported server-side
 * only). Uses the user-session client: RLS pins sent_by to auth.uid().
 */
export async function logClientEmail(input: LogClientEmailInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return;
    const db = supabase as unknown as SupabaseClient;
    const { error } = await db.from('client_email_log').insert({
      case_id: input.caseId,
      kind: input.kind,
      recipient_email: input.recipient,
      subject: input.subject,
      body: input.body,
      sent_by: userId,
    });
    if (error) console.error('[client-email-log] insert failed', error.code);
  } catch (err) {
    console.error('[client-email-log] insert threw', err);
  }
}
