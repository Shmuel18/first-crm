import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { InboxItem, InboxTab } from '../types';

/** Explicit column list — never select('*') from a feature service. */
const EMAIL_INBOX_FULL_COLUMNS =
  'id, gmail_message_id, gmail_thread_id, from_email, from_name, subject, received_at, category, confidence, summary_he, case_id, attachments_count, ingested_document_ids, triage_mode, status, resolved_by, resolved_at, created_at' as const;

const INBOX_SELECT = `
  ${EMAIL_INBOX_FULL_COLUMNS},
  case:case_id(id, case_number)
` as const;

const PAGE_SIZE = 100;

/** RLS scopes rows: view_ai_inbox holders see all, advisors their cases'. */
export async function listInboxItems(tab: InboxTab): Promise<InboxItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from('email_inbox')
    .select(INBOX_SELECT)
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(PAGE_SIZE);

  if (tab === 'attention') query = query.in('status', ['needs_review', 'new']);
  if (tab === 'handled') query = query.in('status', ['acknowledged', 'dismissed']);

  const { data, error } = await query;
  if (error) throw error;
  // PostgREST embedded-relation typing gap; shape per INBOX_SELECT.
  return (data ?? []) as unknown as InboxItem[];
}

export async function countAttentionItems(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('email_inbox')
    .select('id', { count: 'exact', head: true })
    .in('status', ['needs_review', 'new']);
  if (error) return 0;
  return count ?? 0;
}
