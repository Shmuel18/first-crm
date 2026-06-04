'use server';

import { randomUUID } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';

import { sanitizeFilename } from '@/features/documents/domain/sanitize-filename';
import { userCanEditCase } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { RECEIPT_ALLOWED_MIME_TYPES, RECEIPT_MAX_FILE_SIZE_BYTES } from '../schemas/receipt.schema';
import { mirrorReceiptToDrive } from '../services/receipt-drive.service';

const BUCKET = 'case-documents';

export type UploadReceiptResult =
  | { ok: true; receiptName: string; receiptMime: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'rate_limited' | 'storage' | 'not_found';
      message?: 'fileRequired' | 'fileTooLarge' | 'fileTypeNotAllowed';
    };

/**
 * Attaches an invoice to one office expense (feature #8). Single-action upload
 * — the file rides in the FormData (invoices are small, capped at 10 MB). The
 * blob lands in the case-documents bucket under <caseId>/expenses/<uuid>.<ext>
 * via the service-role client: the bucket's INSERT RLS requires the
 * upload_document permission, but the product decision is that anyone who can
 * EDIT the case may attach a receipt — so we authorize with userCanEditCase
 * and bypass the bucket RLS with the admin client. The path stays case-scoped,
 * so user-client reads still resolve through the per-case storage RLS.
 *
 * No revalidatePath: the receipt cell updates optimistically on the client.
 * Revalidating /cases/[id] would re-render the whole heavy case page.
 */
export async function uploadExpenseReceiptAction(
  formData: FormData,
): Promise<UploadReceiptResult> {
  const caseId = String(formData.get('caseId') ?? '');
  const expenseId = String(formData.get('expenseId') ?? '');
  const file = formData.get('file');

  if (!caseId || !expenseId || !(file instanceof File) || file.size <= 0) {
    return { ok: false, error: 'validation', message: 'fileRequired' };
  }
  if (file.size > RECEIPT_MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: 'fileTooLarge' };
  }
  if (!(RECEIPT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }
  const safeName = sanitizeFilename(file.name);
  if (!safeName) return { ok: false, error: 'validation', message: 'fileRequired' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const allowed = await checkRateLimit({
    action: 'upload_expense_receipt',
    subject: `user:${userRes.user.id}:case:${caseId}`,
    max: 30,
    windowSeconds: 3600,
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  // Magic-byte validation — the declared mime is attacker-controlled, so verify
  // the real format from the header bytes before trusting it.
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(buf);
  if (!sniffed || !(RECEIPT_ALLOWED_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }

  // Existing receipt (if replacing) — drop its blob once the new one is saved.
  const { data: existing } = await supabase
    .from('case_expenses')
    .select('receipt_path')
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  // Bail BEFORE uploading if the expense doesn't resolve (forged/stale id, or
  // RLS-hidden) — otherwise the blob (+ Drive copy) lands but no row points to
  // it, and the client gets a false "uploaded".
  if (!existing) return { ok: false, error: 'not_found' };
  const oldPath = existing.receipt_path ?? null;

  const path = `${caseId}/expenses/${randomUUID()}.${sniffed.ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: sniffed.mime, upsert: false });
  if (upErr) {
    console.error('[uploadExpenseReceipt] storage upload failed', upErr);
    return { ok: false, error: 'storage' };
  }

  // Persist the pointer on the expense row (user client → case_expenses RLS).
  const { error: updErr } = await supabase
    .from('case_expenses')
    .update({
      receipt_path: path,
      receipt_name: safeName,
      receipt_mime: sniffed.mime,
      receipt_drive_url: null,
      updated_by: userRes.user.id,
    })
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .is('deleted_at', null);
  if (updErr) {
    await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    console.error('[uploadExpenseReceipt] row update failed', safeDbError(updErr));
    return { ok: false, error: 'storage' };
  }

  // Replace: drop the previous blob now (an in-place replacement isn't a
  // soft-delete, so the retention cron — which now also sweeps soft-deleted
  // expense receipts, migration 139 — won't pick the old blob up).
  if (oldPath && oldPath !== path) {
    await admin.storage.from(BUCKET).remove([oldPath]).catch(() => undefined);
  }

  // Best-effort Drive mirror (decision #3) — never blocks success.
  await mirrorReceiptToDrive(caseId, expenseId, {
    content: buf,
    name: safeName,
    mimeType: sniffed.mime,
  });

  return { ok: true, receiptName: safeName, receiptMime: sniffed.mime };
}
