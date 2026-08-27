import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refresh, revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermissions } from '@/lib/auth/permissions';
import {
  autoSyncIfStale,
  syncDriveDocumentsForCase,
} from '@/features/integrations/services/drive-document-sync';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { autoSyncDriveDocumentsAction, syncDriveDocumentsAction } from './sync-drive-documents';

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
  });
  vi.mocked(userCanEditCase).mockResolvedValue(true);
  vi.mocked(checkRateLimit).mockResolvedValue(true);
}

beforeEach(authorize);

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('syncDriveDocumentsAction', () => {
  it('refreshes truthful partial changes when a later manual-sync check fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(syncDriveDocumentsForCase).mockResolvedValue({
      ok: false,
      reason: 'error',
      message: 'Drive listing incomplete',
      changed: true,
    });

    const result = await syncDriveDocumentsAction(CASE_ID);

    expect(result).toEqual({ ok: false, error: 'unknown' });
    expect(syncDriveDocumentsForCase).toHaveBeenCalledWith(CASE_ID, {
      deleteVanishedFiles: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/cases/${CASE_ID}/documents`);
    // The case page renders nothing document-derived; revalidating it only
    // cost the router its whole prefetch cache on the way back there.
    expect(revalidatePath).not.toHaveBeenCalledWith(`/cases/${CASE_ID}`);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does not revalidate when a forced sync finds Drive unchanged', async () => {
    vi.mocked(syncDriveDocumentsForCase).mockResolvedValue({
      ok: true,
      imported: 0,
      updated: 0,
      skipped: 3,
      deleted: 0,
      pushed: 0,
    });

    const result = await syncDriveDocumentsAction(CASE_ID);

    expect(result).toMatchObject({ ok: true, imported: 0, deleted: 0 });
    // Nothing changed, so nothing to re-render. Revalidating anyway evicted
    // the router's prefetch + bfcache and made the next navigation cold.
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(['imported', 'updated', 'deleted', 'pushed'] as const)(
    'revalidates the documents view when %s changes',
    async (counter) => {
      vi.mocked(syncDriveDocumentsForCase).mockResolvedValue({
        ok: true,
        imported: 0,
        updated: 0,
        skipped: 0,
        deleted: 0,
        pushed: 0,
        [counter]: 1,
      });

      await syncDriveDocumentsAction(CASE_ID);

      expect(revalidatePath).toHaveBeenCalledWith(`/cases/${CASE_ID}/documents`);
      expect(revalidatePath).not.toHaveBeenCalledWith(`/cases/${CASE_ID}`);
      expect(refresh).toHaveBeenCalledOnce();
    },
  );

  it('does not revalidate when a forced sync fails before changing anything', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(syncDriveDocumentsForCase).mockResolvedValue({
      ok: false,
      reason: 'error',
      message: 'Drive listing failed',
    });

    await syncDriveDocumentsAction(CASE_ID);

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
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
    // The case page renders nothing document-derived; revalidating it only
    // cost the router its whole prefetch cache on the way back there.
    expect(revalidatePath).not.toHaveBeenCalledWith(`/cases/${CASE_ID}`);
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

  it('does not revalidate when the freshness window skips the Drive pass', async () => {
    vi.mocked(autoSyncIfStale).mockResolvedValue(null);

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

  it('runs system reconciliation for an editor without UI delete permission', async () => {
    vi.mocked(userHasPermissions).mockResolvedValue({
      view_case_documents: true,
      upload_document: true,
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
      deleteVanishedFiles: true,
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
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes truthful partial changes when a later safety check fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(autoSyncIfStale).mockResolvedValue({
      ok: false,
      reason: 'error',
      message: 'Drive listing incomplete',
      changed: true,
    });

    const result = await autoSyncDriveDocumentsAction(CASE_ID);

    expect(result).toEqual({ ok: false, error: 'unknown' });
    expect(revalidatePath).toHaveBeenCalledWith(`/cases/${CASE_ID}/documents`);
    // The case page renders nothing document-derived; revalidating it only
    // cost the router its whole prefetch cache on the way back there.
    expect(revalidatePath).not.toHaveBeenCalledWith(`/cases/${CASE_ID}`);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
