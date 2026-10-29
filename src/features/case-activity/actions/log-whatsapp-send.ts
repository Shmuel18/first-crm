'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const LogWhatsAppSchema = z.object({
  caseId: z.uuid(),
  kind: z.enum(['advisor_message', 'document_request', 'professional_message']),
  /** Who it was opened to — the client's or the professional's name. */
  recipientName: z.string().trim().max(200),
  phone: z.string().trim().min(1).max(40),
  body: z.string().max(20000),
});

type Result = { ok: true } | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

/**
 * Records that a WhatsApp send was OPENED from the system (migration 254).
 * wa.me hands the text to the advisor's own WhatsApp; whether they then press
 * send is invisible to us, so the case history words it as "opened", never
 * "sent". Best-effort from the caller's side — RLS pins sent_by to the user
 * and requires them to see the case.
 */
export async function logWhatsAppSendAction(input: unknown): Promise<Result> {
  const parsed = LogWhatsAppSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.from('client_email_log').insert({
    case_id: v.caseId,
    kind: v.kind,
    channel: 'whatsapp',
    recipient_phone: v.phone,
    subject: v.recipientName,
    body: v.body,
    sent_by: userRes.user.id,
  });
  if (error) {
    console.error('[logWhatsAppSend] insert failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  revalidatePath(`/cases/${v.caseId}`);
  return { ok: true };
}
