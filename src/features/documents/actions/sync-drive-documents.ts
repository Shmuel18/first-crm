'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { syncDriveDocumentsForCase } from '@/features/integrations/services/drive-document-sync';
import { userCanEditCase, userHasAllPermissions } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; imported: number; updated: number; skipped: number; deleted: number }
  | {
      ok: false;
      error: 'unauthorized' | 'not_connected' | 'case_not_found' | 'no_folder' | 'unknown';
      message?: string;
    };

const SyncDriveDocumentsSchema = z.string().uuid();

export async function syncDriveDocumentsAction(caseId: string): Promise<Result> {
  const parsed = SyncDriveDocumentsSchema.safeParse(caseId);
  if (!parsed.success) return { ok: false, error: 'case_not_found' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (
    !(await userHasAllPermissions('view_case_documents', 'upload_document')) ||
    !(await userCanEditCase(parsed.data))
  ) {
    return { ok: false, error: 'unauthorized' };
  }

  const out = await syncDriveDocumentsForCase(parsed.data);
  if (!out.ok) {
    const error = out.reason === 'error' ? 'unknown' : out.reason;
    return { ok: false, error, message: out.message };
  }

  revalidatePath(`/cases/${parsed.data}/documents`);
  revalidatePath(`/cases/${parsed.data}`);
  return {
    ok: true,
    imported: out.imported,
    updated: out.updated,
    skipped: out.skipped,
    deleted: out.deleted,
  };
}
