import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

import { renderTemplate } from '../domain/render-template';
import type { MessageTemplate, RenderedTemplate, TemplateChannel } from '../types';

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
  'id, name, channel, subject, body, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const table = await templatesTable();
  const { data, error } = await table
    .select(TEMPLATE_FULL_COLUMNS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MessageTemplate[];
}

/**
 * Active templates for the case action bar's message picker, with merge fields
 * substituted server-side ({client_name}, {case_number}, {advisor_name} = the
 * logged-in sender, {office_name}, {date}). Readable by every staff member
 * (RLS policy message_templates_staff_read, migration 160). Returns [] on any
 * failure — the picker simply doesn't render.
 */
export async function listRenderedTemplatesForCase(input: {
  clientName: string;
  caseNumber: string;
  locale: 'he' | 'en';
}): Promise<RenderedTemplate[]> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return [];

    const [{ data: profile }, { data, error }] = await Promise.all([
      supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userRes.user.id)
        .maybeSingle(),
      (supabase as unknown as SupabaseClient)
        .from('message_templates')
        .select('id, name, channel, subject, body')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
    ]);
    if (error || !data) return [];

    const context = {
      client_name: input.clientName,
      case_number: input.caseNumber,
      advisor_name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '',
      office_name: env.NEXT_PUBLIC_APP_NAME,
      date: new Intl.DateTimeFormat(input.locale === 'he' ? 'he-IL' : 'en-GB', {
        dateStyle: 'long',
      }).format(new Date()),
    };

    return (data as RenderedTemplate[]).map((tpl) => ({
      ...tpl,
      subject: tpl.subject ? renderTemplate(tpl.subject, context) : null,
      body: renderTemplate(tpl.body, context),
    }));
  } catch {
    return [];
  }
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

export async function deleteMessageTemplate(id: string, userId: string): Promise<boolean> {
  const table = await templatesTable();
  const { data, error } = await table
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId, updated_by: userId })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}
