'use server';

import { refresh, revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';
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
  if (!(await userHasPermission('verify_document'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

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
    .eq('id', documentId)
    .eq('case_id', caseId); // defense-in-depth: doc must belong to the supplied case

  if (error) {
    console.error('[updateDocumentStatus] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  refresh();
  return { ok: true };
}
