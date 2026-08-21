import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type { SyncRunState } from '../domain/drive-sync-types';
import { sweepVanishedDriveFiles } from './drive-sync-sweeper';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const CASE_ID = '10000000-0000-4000-8000-000000000001';
const USER_ID = '20000000-0000-4000-8000-000000000002';

function makeState(overrides: Partial<SyncRunState> = {}): SyncRunState {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    seenDriveIds: new Set<string>(),
    tombstonedDriveIds: new Set<string>(),
    existingByDriveId: new Map(),
    listingsComplete: true,
    ...overrides,
  };
}

function mockDeleteRpc(error: { message: string } | null = null, removed = true) {
  const getUser = vi.fn(async () => ({
    data: { user: { id: USER_ID } },
    error: null,
  }));
  const rpc = vi.fn(async () => ({ data: removed, error }));

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<
    typeof createAdminClient
  >);

  return { getUser, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sweepVanishedDriveFiles', () => {
  it('soft-deletes and detaches an unseen Drive document without a tombstone', async () => {
    const db = mockDeleteRpc();
    const state = makeState({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'income',
            currentFileName: 'income.pdf',
            currentFileSize: 100,
            currentMimeType: 'application/pdf',
            existingMetadata: { source: 'drive_sync' },
          },
        ],
      ]),
    });

    await sweepVanishedDriveFiles(CASE_ID, state);

    expect(db.rpc).toHaveBeenCalledWith('soft_delete_drive_document_without_tombstone', {
      p_document_id: 'document-1',
      p_case_id: CASE_ID,
      p_user_id: USER_ID,
    });
    expect(state.deleted).toBe(1);
  });

  it('does not honor a legacy drive_missing_since grace window', async () => {
    const db = mockDeleteRpc();
    const state = makeState({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: null,
            currentFileName: 'legacy.pdf',
            currentFileSize: null,
            currentMimeType: 'application/pdf',
            existingMetadata: {
              source: 'drive_sync',
              drive_missing_since: '2026-08-21T09:29:59.000Z',
            },
          },
        ],
      ]),
    });

    await sweepVanishedDriveFiles(CASE_ID, state);

    expect(db.rpc).toHaveBeenCalledOnce();
    expect(state.deleted).toBe(1);
  });

  it('keeps a Drive document that was seen during the sync pass', async () => {
    const db = mockDeleteRpc();
    const state = makeState({
      seenDriveIds: new Set(['drive-file-1']),
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'identity',
            currentFileName: 'identity.pdf',
            currentFileSize: 200,
            currentMimeType: 'application/pdf',
            existingMetadata: { source: 'drive_sync' },
          },
        ],
      ]),
    });

    await sweepVanishedDriveFiles(CASE_ID, state);

    expect(db.rpc).not.toHaveBeenCalled();
    expect(state.deleted).toBe(0);
  });

  it('does nothing when any Drive listing was incomplete', async () => {
    const state = makeState({
      listingsComplete: false,
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'identity',
            currentFileName: 'identity.pdf',
            currentFileSize: 200,
            currentMimeType: 'application/pdf',
            existingMetadata: { source: 'drive_sync' },
          },
        ],
      ]),
    });

    await sweepVanishedDriveFiles(CASE_ID, state);

    expect(createClient).not.toHaveBeenCalled();
    expect(state.deleted).toBe(0);
  });

  it('fails the sync instead of reporting success when the delete RPC fails', async () => {
    const db = mockDeleteRpc({ message: 'delete denied' });
    const state = makeState({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'income',
            currentFileName: 'income.pdf',
            currentFileSize: 100,
            currentMimeType: 'application/pdf',
            existingMetadata: { source: 'drive_sync' },
          },
        ],
      ]),
    });

    await expect(sweepVanishedDriveFiles(CASE_ID, state)).rejects.toThrow(
      'Drive sync could not remove document: delete denied',
    );

    expect(db.rpc).toHaveBeenCalledOnce();
    expect(state.deleted).toBe(0);
  });

  it('fails before deleting when the current user cannot be authenticated', async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      rpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const state = makeState({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'income',
            currentFileName: 'income.pdf',
            currentFileSize: 100,
            currentMimeType: 'application/pdf',
            existingMetadata: { source: 'drive_sync' },
          },
        ],
      ]),
    });

    await expect(sweepVanishedDriveFiles(CASE_ID, state)).rejects.toThrow(
      'Drive sync could not authorize document removal',
    );
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(state.deleted).toBe(0);
  });

  it('treats a concurrent already-gone row as an idempotent no-op', async () => {
    mockDeleteRpc(null, false);
    const state = makeState({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'income',
            currentFileName: 'income.pdf',
            currentFileSize: 100,
            currentMimeType: 'application/pdf',
            existingMetadata: { source: 'drive_sync' },
          },
        ],
      ]),
    });

    await expect(sweepVanishedDriveFiles(CASE_ID, state)).resolves.toBeUndefined();
    expect(state.deleted).toBe(0);
  });
});
