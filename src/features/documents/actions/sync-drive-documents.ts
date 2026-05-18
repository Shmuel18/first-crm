'use server';

import { revalidatePath } from 'next/cache';

import { syncDriveDocumentsForCase } from '@/features/integrations/services/drive-document-sync';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; imported: number; updated: number; skipped: number; deleted: number }
  | {
      ok: false;
      error: 'unauthorized' | 'not_connected' | 'case_not_found' | 'no_folder' | 'unknown';
      message?: string;
    };

export async function syncDriveDocumentsAction(caseId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const out = await syncDriveDocumentsForCase(caseId);
  if (!out.ok) {
    const error = out.reason === 'error' ? 'unknown' : out.reason;
    return { ok: false, error, message: out.message };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  return {
    ok: true,
    imported: out.imported,
    updated: out.updated,
    skipped: out.skipped,
    deleted: out.deleted,
  };
}
