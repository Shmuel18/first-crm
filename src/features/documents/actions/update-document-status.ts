'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

import { DocumentStatusSchema } from '../schemas/document.schema';
import type { DocumentStatus } from '../types';

type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown'; message?: string };

export async function updateDocumentStatusAction(
  documentId: string,
  caseId: string,
  nextStatus: DocumentStatus,
  notes?: string,
): Promise<Result> {
  const parsed = DocumentStatusSchema.safeParse(nextStatus);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const update: DocumentUpdate = { status: parsed.data };
  if (parsed.data === 'verified') {
    update.verified_by = userRes.user.id;
    update.verified_at = new Date().toISOString();
  } else if (parsed.data === 'new' || parsed.data === 'rejected') {
    update.verified_by = null;
    update.verified_at = null;
  }
  if (typeof notes === 'string') update.notes = notes;

  const { error } = await supabase
    .from('documents')
    .update(update)
    .eq('id', documentId);

  if (error) return { ok: false, error: 'unknown', message: error.message };

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
