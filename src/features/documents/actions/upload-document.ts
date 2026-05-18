'use server';

import { revalidatePath } from 'next/cache';

import { getTranslations } from 'next-intl/server';

import { createClient } from '@/lib/supabase/server';

import {
  ALLOWED_MIME_TYPES,
  DocumentMetadataSchema,
  MAX_FILE_SIZE_BYTES,
} from '../schemas/document.schema';
import { persistDocumentBlobs } from '../services/documents.service';
import type { DocumentActionState } from '../types';

export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const t = await getTranslations('documents.errors');
  const caseId = formData.get('case_id');
  const file = formData.get('file');

  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', message: t('caseIdMissing') };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation', message: t('fileRequired') };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: t('fileTooLarge') };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'validation', message: t('fileTypeNotAllowed') };
  }

  const meta = DocumentMetadataSchema.safeParse({
    category_id: formData.get('category_id'),
    borrower_id: formData.get('borrower_id'),
    notes: formData.get('notes'),
    expiry_date: formData.get('expiry_date'),
  });
  if (!meta.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of meta.error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: inserted, error: insertErr } = await supabase
    .from('documents')
    .insert({
      case_id: caseId,
      category_id: meta.data.category_id,
      borrower_id: meta.data.borrower_id ?? null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      notes: meta.data.notes ?? null,
      expiry_date: meta.data.expiry_date ?? null,
      uploaded_by: userRes.user.id,
      status: 'new',
    })
    .select('id')
    .single();
  if (insertErr || !inserted) {
    return { ok: false, error: 'unknown', message: insertErr?.message };
  }

  const result = await persistDocumentBlobs(inserted.id, caseId, file);
  if (!result.ok) {
    await supabase.from('documents').delete().eq('id', inserted.id);
    return { ok: false, error: 'storage', message: result.message };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  return { ok: true, documentId: inserted.id };
}
