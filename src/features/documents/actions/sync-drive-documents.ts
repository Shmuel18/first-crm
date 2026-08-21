'use server';

import { refresh, revalidatePath } from 'next/cache';

import { z } from 'zod';

import {
  autoSyncIfStale,
  syncDriveDocumentsForCase,
} from '@/features/integrations/services/drive-document-sync';
import { userCanEditCase, userHasPermissions } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

type Result =
  | {
      ok: true;
      imported: number;
      updated: number;
      skipped: number;
      deleted: number;
      pushed: number;
    }
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

type AuthorizedSyncUser = { userId: string };

async function authorizedSyncUser(caseId: string): Promise<AuthorizedSyncUser | null> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  const permissions = await userHasPermissions('view_case_documents', 'upload_document');
  const allowed =
    permissions.view_case_documents === true &&
    permissions.upload_document === true &&
    (await userCanEditCase(caseId));
  return allowed ? { userId: userRes.user.id } : null;
}

function refreshDocumentViews(caseId: string) {
  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
}

export async function syncDriveDocumentsAction(caseId: string): Promise<Result> {
  const parsed = SyncDriveDocumentsSchema.safeParse(caseId);
  if (!parsed.success) return { ok: false, error: 'case_not_found' };

  const actor = await authorizedSyncUser(parsed.data);
  if (!actor) return { ok: false, error: 'unauthorized' };

  // Drive sync hits Google API quotas and runs an N+1 over folder contents.
  // 1 per 30s per (user, case) is far more than legitimate use needs, and
  // catches runaway polling from a buggy client or open browser tab.
  const allowed = await checkRateLimit({
    action: 'sync_drive_documents',
    subject: `user:${actor.userId}:case:${parsed.data}`,
    max: 1,
    windowSeconds: 30,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const out = await syncDriveDocumentsForCase(parsed.data, {
    // This is system reconciliation, not a discretionary UI delete. The
    // service-only detach RPC makes Drive exact even for editors who do not
    // hold delete_document, while remaining unreachable from browser clients.
    deleteVanishedFiles: true,
  });
  if (!out.ok) {
    if (out.changed) {
      // Drive and database calls cannot share one transaction. If an early
      // import/update succeeded before a later fail-closed check, show that
      // truthful partial state while the unstamped sync retries next time.
      refreshDocumentViews(parsed.data);
      refresh();
    }
    const error = out.reason === 'error' ? 'unknown' : out.reason;
    if (out.message) console.error('[syncDriveDocuments]', out.reason, out.message);
    return { ok: false, error };
  }

  refreshDocumentViews(parsed.data);
  if (out.imported > 0 || out.updated > 0 || out.deleted > 0 || out.pushed > 0) {
    refresh();
  }
  return {
    ok: true,
    imported: out.imported,
    updated: out.updated,
    skipped: out.skipped,
    deleted: out.deleted,
    pushed: out.pushed,
  };
}

type AutoSyncResult =
  | { ok: true; changed: boolean }
  | { ok: false; error: 'unauthorized' | 'not_connected' | 'unknown' };

/**
 * Client-on-mount freshness pass. Unlike the old unawaited Server Component
 * promise, this request is owned by the browser and refreshes the current UI
 * when Drive changed. The service-level timestamp keeps repeat mounts cheap.
 */
export async function autoSyncDriveDocumentsAction(caseId: string): Promise<AutoSyncResult> {
  const parsed = SyncDriveDocumentsSchema.safeParse(caseId);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const actor = await authorizedSyncUser(parsed.data);
  if (!actor) return { ok: false, error: 'unauthorized' };

  const out = await autoSyncIfStale(parsed.data, {
    deleteVanishedFiles: true,
  });
  if (!out) return { ok: true, changed: false };
  if (!out.ok) {
    if (out.changed) {
      refreshDocumentViews(parsed.data);
      refresh();
    }
    if (out.message) console.error('[autoSyncDriveDocuments]', out.reason, out.message);
    return {
      ok: false,
      error: out.reason === 'not_connected' ? 'not_connected' : 'unknown',
    };
  }

  const changed = out.imported > 0 || out.updated > 0 || out.deleted > 0 || out.pushed > 0;
  if (changed) {
    refreshDocumentViews(parsed.data);
    // Server Actions can return the refreshed React tree in this roundtrip.
    // This makes a Drive deletion disappear during the current visit.
    refresh();
  }
  return { ok: true, changed };
}
