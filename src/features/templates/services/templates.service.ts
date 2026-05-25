import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import type { MessageTemplate, TemplateChannel } from '../types';

// message_templates is created in migration 035 and isn't in the generated
// Database types yet, so it's reached through an untyped client view. RLS
// (admin-only) is the real guard; callers also verify admin up front.
async function templatesTable() {
  const supabase = await createClient();
  return (supabase as unknown as SupabaseClient).from('message_templates');
}

export type TemplateInput = {
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
};

// Explicit column list (audit-driven). message_templates is reached via the
// untyped client (no generated Database type for migration 035 yet), so the
// list is hand-maintained — adding a column to the table requires updating
// the MessageTemplate type AND this list.
const TEMPLATE_FULL_COLUMNS =
  'id, name, channel, subject, body, is_active, created_at, created_by, updated_at, updated_by' as const;

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const table = await templatesTable();
  const { data, error } = await table
    .select(TEMPLATE_FULL_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MessageTemplate[];
}

export async function insertMessageTemplate(
  input: TemplateInput,
  userId: string,
): Promise<string | null> {
  const table = await templatesTable();
  const { data, error } = await table
    .insert({ ...input, created_by: userId, updated_by: userId })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function updateMessageTemplate(
  id: string,
  input: TemplateInput,
  userId: string,
): Promise<boolean> {
  const table = await templatesTable();
  // .select() row-count guard: RLS is admin-only, so a non-admin update affects
  // 0 rows with no error — treat that as a failed (unauthorized) update.
  const { data, error } = await table
    .update({ ...input, updated_by: userId })
    .eq('id', id)
    .select('id');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function deleteMessageTemplate(id: string): Promise<boolean> {
  const table = await templatesTable();
  const { data, error } = await table.delete().eq('id', id).select('id');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}
