import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '@/lib/supabase/server';

import type { DriveFileMeta } from '../domain/drive-folder-naming';
import type { SyncRunState } from '../domain/drive-sync-types';
import { importOrUpdateDriveFile } from './drive-sync-importer';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const CASE_ID = '10000000-0000-4000-8000-000000000001';

function file(overrides: Partial<DriveFileMeta> = {}): DriveFileMeta {
  return {
    id: 'drive-file-1',
    name: 'renamed.pdf',
    mimeType: 'application/pdf',
    size: '250',
    webViewLink: 'https://drive.google.com/file/d/drive-file-1/view',
    modifiedTime: '2026-08-21T12:00:00.000Z',
    createdTime: '2026-08-21T10:00:00.000Z',
    ...overrides,
  };
}

function state(overrides: Partial<SyncRunState> = {}): SyncRunState {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    seenDriveIds: new Set(),
    tombstonedDriveIds: new Set(),
    existingByDriveId: new Map(),
    listingsComplete: true,
    ...overrides,
  };
}

function mockUpdate(error: { message: string } | null = null, updated = true) {
  const maybeSingle = vi.fn(async () => ({ data: updated ? { id: 'document-1' } : null, error }));
  const select = vi.fn(() => ({ maybeSingle }));
  const is = vi.fn(() => ({ select }));
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => ({ update })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { update, eq, is, select, maybeSingle };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('importOrUpdateDriveFile', () => {
  it('updates category, nested path, name, size and MIME while preserving app metadata', async () => {
    const db = mockUpdate();
    const syncState = state({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'income_il',
            currentFileName: 'old-name.pdf',
            currentFileSize: 100,
            currentMimeType: 'application/octet-stream',
            existingMetadata: {
              source: 'app_upload',
              storage_path: `${CASE_ID}/document-1.pdf`,
              drive_parent_folder_id: 'old-folder',
              drive_relative_path: ['הכנסות'],
            },
          },
        ],
      ]),
    });

    await importOrUpdateDriveFile(CASE_ID, file(), 'identity-category', 'identity', syncState, {
      parentFolderId: 'nested-folder',
      relativePath: ['זהות', 'דרכונים'],
    });

    expect(db.update).toHaveBeenCalledWith({
      category_id: 'identity-category',
      file_name: 'renamed.pdf',
      file_size: 250,
      mime_type: 'application/pdf',
      metadata: {
        source: 'app_upload',
        storage_path: `${CASE_ID}/document-1.pdf`,
        drive_parent_folder_id: 'nested-folder',
        drive_relative_path: ['זהות', 'דרכונים'],
      },
    });
    expect(db.eq).toHaveBeenCalledWith('id', 'document-1');
    expect(syncState.seenDriveIds).toEqual(new Set(['drive-file-1']));
    expect(syncState.updated).toBe(1);
    expect(syncState.skipped).toBe(0);
  });

  it('counts an unchanged known file as skipped without writing', async () => {
    const db = mockUpdate();
    const syncState = state({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: 'identity',
            currentFileName: 'renamed.pdf',
            currentFileSize: 250,
            currentMimeType: 'application/pdf',
            existingMetadata: {
              source: 'drive_sync',
              drive_parent_folder_id: 'nested-folder',
              drive_relative_path: ['זהות', 'דרכונים'],
            },
          },
        ],
      ]),
    });

    await importOrUpdateDriveFile(CASE_ID, file(), 'identity-category', 'identity', syncState, {
      parentFolderId: 'nested-folder',
      relativePath: ['זהות', 'דרכונים'],
    });

    expect(db.update).not.toHaveBeenCalled();
    expect(syncState.updated).toBe(0);
    expect(syncState.skipped).toBe(1);
  });

  it('fails the pass when a document mirror update fails', async () => {
    mockUpdate({ message: 'update denied' });
    const syncState = state({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: null,
            currentFileName: 'old.pdf',
            currentFileSize: null,
            currentMimeType: null,
            existingMetadata: {},
          },
        ],
      ]),
    });

    await expect(
      importOrUpdateDriveFile(CASE_ID, file(), null, null, syncState, {
        parentFolderId: 'case-folder',
        relativePath: [],
      }),
    ).rejects.toThrow('Drive sync could not update document: update denied');
    expect(syncState.updated).toBe(0);
  });

  it('does not overwrite a concurrent delete or count a missing active row', async () => {
    mockUpdate(null, false);
    const syncState = state({
      existingByDriveId: new Map([
        [
          'drive-file-1',
          {
            docId: 'document-1',
            currentDriveFolder: null,
            currentFileName: 'old.pdf',
            currentFileSize: null,
            currentMimeType: null,
            existingMetadata: {},
          },
        ],
      ]),
    });

    await importOrUpdateDriveFile(CASE_ID, file(), null, null, syncState, {
      parentFolderId: 'case-folder',
      relativePath: [],
    });

    expect(syncState.updated).toBe(0);
    expect(syncState.skipped).toBe(1);
  });

  it('imports a new nested Drive file with its exact parent and path', async () => {
    const single = vi.fn(async () => ({ data: { id: 'document-1' }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    const syncState = state();

    await importOrUpdateDriveFile(CASE_ID, file(), 'income-category', 'income_il', syncState, {
      parentFolderId: 'year-folder',
      relativePath: ['הכנסות', '2026'],
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: CASE_ID,
        category_id: 'income-category',
        drive_file_id: 'drive-file-1',
        status: 'verified',
        metadata: {
          source: 'drive_sync',
          drive_parent_folder_id: 'year-folder',
          drive_relative_path: ['הכנסות', '2026'],
        },
      }),
    );
    expect(syncState.imported).toBe(1);
    expect(syncState.existingByDriveId.get('drive-file-1')?.docId).toBe('document-1');
  });

  it('fails the pass when an insert returns no document row', async () => {
    const single = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await expect(
      importOrUpdateDriveFile(CASE_ID, file(), null, null, state(), {
        parentFolderId: 'case-folder',
        relativePath: [],
      }),
    ).rejects.toThrow('Drive sync could not import document: insert returned no row');
  });

  it('does not resurrect a file explicitly deleted from the site', async () => {
    const syncState = state({ tombstonedDriveIds: new Set(['drive-file-1']) });

    await importOrUpdateDriveFile(CASE_ID, file(), null, null, syncState, {
      parentFolderId: 'case-folder',
      relativePath: [],
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(syncState.seenDriveIds).toEqual(new Set());
    expect(syncState.skipped).toBe(1);
  });
});
