import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '@/lib/supabase/server';

import { getDriveClientIfConnected } from './drive-case-uploader';
import { syncDriveDocumentsForCase } from './drive-document-sync';
import { importOrUpdateDriveFile } from './drive-sync-importer';
import { pushLocalOnlyFilesToDrive } from './drive-push-backfill';
import { sweepVanishedDriveFiles } from './drive-sync-sweeper';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('./drive-case-uploader', () => ({ getDriveClientIfConnected: vi.fn() }));
vi.mock('./drive-push-backfill', () => ({ pushLocalOnlyFilesToDrive: vi.fn() }));
vi.mock('./drive-sync-importer', () => ({ importOrUpdateDriveFile: vi.fn() }));
vi.mock('./drive-sync-sweeper', () => ({ sweepVanishedDriveFiles: vi.fn() }));

const CASE_ID = '11111111-1111-4111-8111-111111111111';

function mockDatabase({
  existingDocuments = [],
}: {
  existingDocuments?: Array<{
    id: string;
    drive_file_id: string;
    metadata: Record<string, unknown>;
    category: { drive_folder: string } | null;
  }>;
} = {}) {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const from = vi.fn((table: string) => {
    if (table === 'cases') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: CASE_ID,
                metadata: { drive: { case_folder_id: 'case-folder' } },
              },
              error: null,
            })),
          })),
        })),
      };
    }
    if (table === 'document_categories') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      };
    }
    if (table === 'documents') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              not: vi.fn(async () => ({ data: existingDocuments, error: null })),
            })),
          })),
        })),
      };
    }
    if (table === 'document_drive_tombstones') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<
    ReturnType<typeof createClient>
  >);
  return { from, rpc };
}

function mockDrive(overrides: Record<string, unknown> = {}) {
  const drive = {
    isManagedCaseFolder: vi.fn(async () => true),
    isLiveFile: vi.fn(async () => false),
    listSubfolders: vi.fn(async () => []),
    listFolderFilesPaginated: vi.fn(async () => []),
    ...overrides,
  };
  vi.mocked(getDriveClientIfConnected).mockResolvedValue(
    drive as unknown as NonNullable<Awaited<ReturnType<typeof getDriveClientIfConnected>>>,
  );
  return drive;
}

beforeEach(() => {
  mockDatabase();
  mockDrive();
  vi.mocked(pushLocalOnlyFilesToDrive).mockResolvedValue(0);
  vi.mocked(sweepVanishedDriveFiles).mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('syncDriveDocumentsForCase safety', () => {
  it('keeps known files seen when their Drive subfolder was renamed', async () => {
    const renamedFile = {
      id: 'drive-file-1',
      name: 'document.pdf',
      mimeType: 'application/pdf',
    };
    mockDrive({
      listSubfolders: vi.fn(async () => [{ id: 'renamed-folder', name: 'שם מותאם' }]),
      listFolderFilesPaginated: vi.fn(async (folderId: string) =>
        folderId === 'renamed-folder' ? [renamedFile] : [],
      ),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, {
      deleteVanishedFiles: true,
    });

    expect(result).toMatchObject({ ok: true, skipped: 1, deleted: 0 });
    expect(importOrUpdateDriveFile).not.toHaveBeenCalled();
    expect(sweepVanishedDriveFiles).toHaveBeenCalledWith(
      CASE_ID,
      expect.objectContaining({ seenDriveIds: new Set(['drive-file-1']) }),
    );
  });

  it('fails without sweeping or stamping when any Drive listing is incomplete', async () => {
    const { rpc } = mockDatabase();
    mockDrive({
      listFolderFilesPaginated: vi.fn(async () => {
        throw new Error('Drive list folder failed: 503');
      }),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, {
      deleteVanishedFiles: true,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Drive list folder failed: 503',
    });
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not delete a live file that moved outside the scanned folder layout', async () => {
    mockDatabase({
      existingDocuments: [
        {
          id: 'document-1',
          drive_file_id: 'drive-file-1',
          metadata: { source: 'drive_sync' },
          category: { drive_folder: 'income' },
        },
      ],
    });
    const drive = mockDrive({ isLiveFile: vi.fn(async () => true) });

    const result = await syncDriveDocumentsForCase(CASE_ID, {
      deleteVanishedFiles: true,
    });

    expect(result).toMatchObject({ ok: true, skipped: 1, deleted: 0 });
    expect(drive.isLiveFile).toHaveBeenCalledWith('drive-file-1');
    expect(sweepVanishedDriveFiles).toHaveBeenCalledWith(
      CASE_ID,
      expect.objectContaining({ seenDriveIds: new Set(['drive-file-1']) }),
    );
  });

  it('leaves a Drive 404 unseen so the same pass deletes it', async () => {
    mockDatabase({
      existingDocuments: [
        {
          id: 'document-1',
          drive_file_id: 'drive-file-1',
          metadata: { source: 'drive_sync' },
          category: { drive_folder: 'income' },
        },
      ],
    });
    const drive = mockDrive({ isLiveFile: vi.fn(async () => false) });

    await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(drive.isLiveFile).toHaveBeenCalledWith('drive-file-1');
    expect(sweepVanishedDriveFiles).toHaveBeenCalledWith(
      CASE_ID,
      expect.objectContaining({ seenDriveIds: new Set() }),
    );
  });

  it('refuses to scan a missing or mismatched case folder', async () => {
    const drive = mockDrive({ isManagedCaseFolder: vi.fn(async () => false) });

    const result = await syncDriveDocumentsForCase(CASE_ID, {
      deleteVanishedFiles: true,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Case Drive folder is missing or does not belong to this case',
    });
    expect(drive.listSubfolders).not.toHaveBeenCalled();
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
  });
});
