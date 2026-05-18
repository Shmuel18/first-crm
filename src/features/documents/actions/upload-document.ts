'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import {
  ALLOWED_MIME_TYPES,
  DocumentMetadataSchema,
  MAX_FILE_SIZE_BYTES,
} from '../schemas/document.schema';
import type { DocumentActionState } from '../types';
import { storagePathFor } from '../services/documents.service';

const BUCKET = 'case-documents';

export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const caseId = formData.get('case_id');
  const file = formData.get('file');

  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', message: 'case_id חסר' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation', message: 'יש לבחור קובץ להעלאה' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: 'הקובץ חורג מגודל מקסימלי (20MB)' };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'validation', message: 'סוג קובץ לא נתמך' };
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

  const path = storagePathFor(caseId, inserted.id, file.name);
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (storageErr) {
    await supabase.from('documents').delete().eq('id', inserted.id);
    return { ok: false, error: 'storage', message: storageErr.message };
  }

  await supabase
    .from('documents')
    .update({ metadata: { storage_path: path } })
    .eq('id', inserted.id);

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  return { ok: true, documentId: inserted.id };
}
