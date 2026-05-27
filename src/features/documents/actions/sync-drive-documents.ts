'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { syncDriveDocumentsForCase } from '@/features/integrations/services/drive-document-sync';
import { userCanEditCase, userHasAllPermissions } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; imported: number; updated: number; skipped: number; deleted: number }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'not_connected'
        | 'case_not_found'
        | 'no_folder'
        | 'rate_limited'
        | 'unknown';
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

  // Drive sync hits Google API quotas and runs an N+1 over folder contents.
  // 1 per 30s per (user, case) is far more than legitimate use needs, and
  // catches runaway polling from a buggy client or open browser tab.
  const allowed = await checkRateLimit({
    action: 'sync_drive_documents',
    subject: `user:${userRes.user.id}:case:${parsed.data}`,
    max: 1,
    windowSeconds: 30,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const out = await syncDriveDocumentsForCase(parsed.data);
  if (!out.ok) {
    const error = out.reason === 'error' ? 'unknown' : out.reason;
    if (out.message) console.error('[syncDriveDocuments]', out.reason, out.message);
    return { ok: false, error };
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
