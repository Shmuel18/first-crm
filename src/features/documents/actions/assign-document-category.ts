'use server';

import { z } from 'zod';

import {
  moveCaseDocumentToDriveFolder,
  restoreCaseDocumentDriveParent,
  type DriveCaseMoveOutcome,
} from '@/features/integrations/services/drive-case-uploader';
import { userCanEditCase, userHasPermissions } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';
import type { Database, Json } from '@/types/database';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown'; message?: string };

type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
type SuccessfulDriveMove = Extract<DriveCaseMoveOutcome, { ok: true }>;

const AssignDocumentCategorySchema = z.object({
  documentId: z.string().uuid(),
  caseId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

function metadataObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

export async function assignDocumentCategoryAction(
  documentId: string,
  caseId: string,
  categoryId: string,
): Promise<Result> {
  const parsed = AssignDocumentCategorySchema.safeParse({ documentId, caseId, categoryId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Same permission gate the other doc actions use: verifying a doc
  // (including re-categorizing) requires verify_document or upload_document.
  const permissions = await userHasPermissions('verify_document', 'upload_document');
  if (
    (permissions.verify_document !== true && permissions.upload_document !== true) ||
    !(await userCanEditCase(parsed.data.caseId))
  ) {
    return { ok: false, error: 'unauthorized' };
  }

  const [documentResult, categoryResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, drive_file_id, metadata')
      .eq('id', parsed.data.documentId)
      .eq('case_id', parsed.data.caseId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('document_categories')
      .select('id, drive_folder')
      .eq('id', parsed.data.categoryId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (documentResult.error || categoryResult.error) {
    console.error('[assignDocumentCategory] lookup error', {
      document: documentResult.error ? safeDbError(documentResult.error) : null,
      category: categoryResult.error ? safeDbError(categoryResult.error) : null,
    });
    return { ok: false, error: 'unknown' };
  }
  if (!documentResult.data || !categoryResult.data) {
    return { ok: false, error: 'validation' };
  }

  let driveMove: SuccessfulDriveMove | null = null;
  if (documentResult.data.drive_file_id) {
    const move = await moveCaseDocumentToDriveFolder({
      caseId: parsed.data.caseId,
      driveFileId: documentResult.data.drive_file_id,
      driveFolder: categoryResult.data.drive_folder,
    });
    if (!move.ok) {
      console.error('[assignDocumentCategory] Drive move failed', {
        reason: move.reason,
        message: move.message,
      });
      return { ok: false, error: 'unknown' };
    }
    driveMove = move;
  }

  const update: DocumentUpdate = { category_id: parsed.data.categoryId };
  if (driveMove) {
    update.metadata = {
      ...metadataObject(documentResult.data.metadata),
      drive_parent_folder_id: driveMove.targetFolderId,
      drive_relative_path: [driveMove.targetFolderName],
    };
  }

  const { data: updated, error } = await supabase
    .from('documents')
    .update(update)
    .eq('id', parsed.data.documentId)
    .eq('case_id', parsed.data.caseId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error || !updated) {
    if (driveMove?.changed && documentResult.data.drive_file_id) {
      const restored = await restoreCaseDocumentDriveParent({
        driveFileId: documentResult.data.drive_file_id,
        expectedCurrentParentId: driveMove.targetFolderId,
        previousParents: driveMove.previousParents,
      });
      if (!restored) {
        console.error('[assignDocumentCategory] Drive compensation incomplete', {
          documentId: parsed.data.documentId,
        });
      }
    }
    console.error(
      '[assignDocumentCategory] db error',
      error ? safeDbError(error) : { message: 'Document was not updated' },
    );
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath: re-rendering the heavy documents page into the POST response
  // kept the <select> disabled with a spinner ~1s to categorize one document. The row
  // hides itself optimistically and calls router.refresh() in the background instead.
  return { ok: true };
}
