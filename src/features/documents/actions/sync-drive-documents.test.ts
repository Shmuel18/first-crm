import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refresh, revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermissions } from '@/lib/auth/permissions';
import { autoSyncIfStale } from '@/features/integrations/services/drive-document-sync';
import { createClient } from '@/lib/supabase/server';

import { autoSyncDriveDocumentsAction } from './sync-drive-documents';

vi.mock('next/cache', () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/features/integrations/services/drive-document-sync', () => ({
  autoSyncIfStale: vi.fn(),
  syncDriveDocumentsForCase: vi.fn(),
}));
vi.mock('@/lib/auth/permissions', () => ({
  userCanEditCase: vi.fn(),
  userHasPermissions: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function authorize() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } } })),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(userHasPermissions).mockResolvedValue({
    view_case_documents: true,
    upload_document: true,
    delete_document: true,
  });
  vi.mocked(userCanEditCase).mockResolvedValue(true);
}

beforeEach(authorize);

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('autoSyncDriveDocumentsAction', () => {
  it('refreshes the current documents view when Drive removed a file', async () => {
    vi.mocked(autoSyncIfStale).mockResolvedValue({
      ok: true,
      imported: 0,
      updated: 0,
      skipped: 2,
      deleted: 1,
      pushed: 0,
    });

    const result = await autoSyncDriveDocumentsAction(CASE_ID);

    expect(result).toEqual({ ok: true, changed: true });
    expect(autoSyncIfStale).toHaveBeenCalledWith(CASE_ID, {
      deleteVanishedFiles: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/cases/${CASE_ID}/documents`);
    expect(revalidatePath).toHaveBeenCalledWith(`/cases/${CASE_ID}`);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does not refresh when the recent Drive snapshot is unchanged', async () => {
    vi.mocked(autoSyncIfStale).mockResolvedValue({
      ok: true,
      imported: 0,
      updated: 0,
      skipped: 2,
      deleted: 0,
      pushed: 0,
    });

    const result = await autoSyncDriveDocumentsAction(CASE_ID);

    expect(result).toEqual({ ok: true, changed: false });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not start a Drive pass for an unauthorized caller', async () => {
    vi.mocked(userCanEditCase).mockResolvedValue(false);

    const result = await autoSyncDriveDocumentsAction(CASE_ID);

    expect(result).toEqual({ ok: false, error: 'unauthorized' });
    expect(autoSyncIfStale).not.toHaveBeenCalled();
  });

  it('imports for an editor without granting Drive reconciliation delete rights', async () => {
    vi.mocked(userHasPermissions).mockResolvedValue({
      view_case_documents: true,
      upload_document: true,
      delete_document: false,
    });
    vi.mocked(autoSyncIfStale).mockResolvedValue({
      ok: true,
      imported: 1,
      updated: 0,
      skipped: 0,
      deleted: 0,
      pushed: 0,
    });

    await autoSyncDriveDocumentsAction(CASE_ID);

    expect(autoSyncIfStale).toHaveBeenCalledWith(CASE_ID, {
      deleteVanishedFiles: false,
    });
  });

  it('surfaces an incomplete Drive listing instead of refreshing stale data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(autoSyncIfStale).mockResolvedValue({
      ok: false,
      reason: 'error',
      message: 'Drive listing incomplete',
    });

    const result = await autoSyncDriveDocumentsAction(CASE_ID);

    expect(result).toEqual({ ok: false, error: 'unknown' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
