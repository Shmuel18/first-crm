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

type ExistingDocument = {
  id: string;
  drive_file_id: string;
  drive_file_url: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  category: { drive_folder: string } | null;
};

function knownDocument(overrides: Partial<ExistingDocument> = {}): ExistingDocument {
  return {
    id: 'document-1',
    drive_file_id: 'drive-file-1',
    drive_file_url: 'https://drive.google.com/file/d/drive-file-1/view',
    file_name: 'document.pdf',
    file_size: 100,
    mime_type: 'application/pdf',
    metadata: { source: 'drive_sync' },
    category: { drive_folder: 'income_il' },
    ...overrides,
  };
}

function driveFile(id: string, name = `${id}.pdf`) {
  return {
    id,
    name,
    mimeType: 'application/pdf',
    size: '100',
    webViewLink: `https://drive.google.com/file/d/${id}/view`,
    modifiedTime: '2026-08-21T10:00:00.000Z',
    createdTime: '2026-08-21T09:00:00.000Z',
  };
}

function mockDatabase({
  existingDocuments = [],
  categories = [],
  driveMeta = { case_folder_id: 'case-folder' },
}: {
  existingDocuments?: ExistingDocument[];
  categories?: Array<{
    id: string;
    key: string;
    drive_folder: string;
    sort_order: number;
  }>;
  driveMeta?: Record<string, unknown>;
} = {}) {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const from = vi.fn((table: string) => {
    if (table === 'cases') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: CASE_ID, metadata: { drive: driveMeta } },
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
            order: vi.fn(async () => ({ data: categories, error: null })),
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
    getFilePlacement: vi.fn(async () => null),
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
  vi.mocked(importOrUpdateDriveFile).mockImplementation(async (_caseId, file, ...args) => {
    const state = args[2];
    state.seenDriveIds.add(file.id);
    state.skipped += 1;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('syncDriveDocumentsForCase exact mirror', () => {
  it('recursively imports nested files with the top-level category and persists empty folders', async () => {
    const { rpc } = mockDatabase({
      categories: [
        { id: 'income-category', key: 'income', drive_folder: 'income_il', sort_order: 1 },
      ],
      driveMeta: {
        case_folder_id: 'case-folder',
        subfolders: { income_il: 'income-folder' },
      },
    });
    const nestedFile = driveFile('nested-file', 'pay-slip.pdf');
    mockDrive({
      listSubfolders: vi.fn(async (folderId: string) => {
        if (folderId === 'case-folder') return [{ id: 'income-folder', name: 'הכנסות' }];
        if (folderId === 'income-folder') return [{ id: 'year-folder', name: '2026' }];
        if (folderId === 'year-folder') return [{ id: 'empty-folder', name: 'ריק' }];
        return [];
      }),
      listFolderFilesPaginated: vi.fn(async (folderId: string) =>
        folderId === 'year-folder' ? [nestedFile] : [],
      ),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(result).toMatchObject({ ok: true, updated: 1 });
    expect(importOrUpdateDriveFile).toHaveBeenCalledWith(
      CASE_ID,
      nestedFile,
      'income-category',
      'income_il',
      expect.any(Object),
      {
        parentFolderId: 'year-folder',
        relativePath: ['הכנסות', '2026'],
      },
    );
    expect(rpc).toHaveBeenCalledWith('update_case_drive_meta', {
      p_case_id: CASE_ID,
      p_patch: expect.objectContaining({
        subfolders: { income_il: 'income-folder' },
        folder_tree: [
          {
            id: 'income-folder',
            parent_id: 'case-folder',
            name: 'הכנסות',
            relative_path: ['הכנסות'],
          },
          {
            id: 'year-folder',
            parent_id: 'income-folder',
            name: '2026',
            relative_path: ['הכנסות', '2026'],
          },
          {
            id: 'empty-folder',
            parent_id: 'year-folder',
            name: 'ריק',
            relative_path: ['הכנסות', '2026', 'ריק'],
          },
        ],
        last_synced_at: expect.any(String),
      }),
    });
  });

  it('imports files under a custom top-level folder as uncategorized', async () => {
    const customFile = driveFile('custom-file');
    mockDrive({
      listSubfolders: vi.fn(async (folderId: string) =>
        folderId === 'case-folder' ? [{ id: 'custom-folder', name: 'מותאם' }] : [],
      ),
      listFolderFilesPaginated: vi.fn(async (folderId: string) =>
        folderId === 'custom-folder' ? [customFile] : [],
      ),
    });

    await syncDriveDocumentsForCase(CASE_ID);

    expect(importOrUpdateDriveFile).toHaveBeenCalledWith(
      CASE_ID,
      customFile,
      null,
      null,
      expect.any(Object),
      { parentFolderId: 'custom-folder', relativePath: ['מותאם'] },
    );
  });

  it('uses a stable cached category id across rename and leaves a duplicate name custom', async () => {
    mockDatabase({
      categories: [
        { id: 'income-category', key: 'income', drive_folder: 'income_il', sort_order: 1 },
      ],
      driveMeta: {
        case_folder_id: 'case-folder',
        subfolders: { income_il: 'canonical-income' },
      },
    });
    const canonicalFile = driveFile('canonical-file');
    const duplicateFile = driveFile('duplicate-file');
    mockDrive({
      listSubfolders: vi.fn(async (folderId: string) =>
        folderId === 'case-folder'
          ? [
              { id: 'canonical-income', name: 'שם חדש' },
              { id: 'duplicate-income', name: '02_תעסוקה_והכנסות' },
            ]
          : [],
      ),
      listFolderFilesPaginated: vi.fn(async (folderId: string) => {
        if (folderId === 'canonical-income') return [canonicalFile];
        if (folderId === 'duplicate-income') return [duplicateFile];
        return [];
      }),
    });

    await syncDriveDocumentsForCase(CASE_ID);

    expect(importOrUpdateDriveFile).toHaveBeenCalledWith(
      CASE_ID,
      canonicalFile,
      'income-category',
      'income_il',
      expect.any(Object),
      expect.any(Object),
    );
    expect(importOrUpdateDriveFile).toHaveBeenCalledWith(
      CASE_ID,
      duplicateFile,
      null,
      null,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('heals a stale cached id only from one unambiguous canonical-name match', async () => {
    const { rpc } = mockDatabase({
      categories: [
        { id: 'income-category', key: 'income', drive_folder: 'income_il', sort_order: 1 },
      ],
      driveMeta: {
        case_folder_id: 'case-folder',
        subfolders: { income_il: 'old-income-folder' },
      },
    });
    const replacementFile = driveFile('replacement-file');
    mockDrive({
      listSubfolders: vi.fn(async (folderId: string) =>
        folderId === 'case-folder' ? [{ id: 'new-income-folder', name: '02_תעסוקה_והכנסות' }] : [],
      ),
      listFolderFilesPaginated: vi.fn(async (folderId: string) =>
        folderId === 'new-income-folder' ? [replacementFile] : [],
      ),
    });

    await syncDriveDocumentsForCase(CASE_ID);

    expect(importOrUpdateDriveFile).toHaveBeenCalledWith(
      CASE_ID,
      replacementFile,
      'income-category',
      'income_il',
      expect.any(Object),
      expect.any(Object),
    );
    expect(rpc).toHaveBeenCalledWith(
      'update_case_drive_meta',
      expect.objectContaining({
        p_patch: expect.objectContaining({ subfolders: { income_il: 'new-income-folder' } }),
      }),
    );
  });

  it('fails without sweeping or stamping when a nested Drive listing is incomplete', async () => {
    const { rpc } = mockDatabase();
    mockDrive({
      listSubfolders: vi.fn(async (folderId: string) => {
        if (folderId === 'case-folder') return [{ id: 'nested-folder', name: 'מותאם' }];
        if (folderId === 'nested-folder') throw new Error('Drive list subfolders failed: 503');
        return [];
      }),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Drive list subfolders failed: 503',
    });
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports a partial mutation when an import succeeded before a later listing failed', async () => {
    const { rpc } = mockDatabase();
    const rootFile = driveFile('root-file');
    vi.mocked(importOrUpdateDriveFile).mockImplementationOnce(
      async (_caseId, file, _categoryId, _driveFolder, state) => {
        state.seenDriveIds.add(file.id);
        state.imported += 1;
      },
    );
    mockDrive({
      listFolderFilesPaginated: vi.fn(async (folderId: string) =>
        folderId === 'case-folder' ? [rootFile] : [],
      ),
      listSubfolders: vi.fn(async () => {
        throw new Error('Drive list subfolders failed: 503');
      }),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Drive list subfolders failed: 503',
      changed: true,
    });
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sweeps a live file whose verified ancestry is outside the managed case tree', async () => {
    mockDatabase({ existingDocuments: [knownDocument()] });
    const getFilePlacement = vi.fn(async (fileId: string) => {
      if (fileId === 'drive-file-1') return { trashed: false, parents: ['outside-folder'] };
      if (fileId === 'outside-folder') return { trashed: false, parents: ['drive-root'] };
      if (fileId === 'drive-root') return { trashed: false, parents: [] };
      return null;
    });
    mockDrive({ getFilePlacement });

    await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(getFilePlacement).toHaveBeenCalledWith('drive-file-1');
    expect(sweepVanishedDriveFiles).toHaveBeenCalledWith(
      CASE_ID,
      expect.objectContaining({ seenDriveIds: new Set() }),
    );
  });

  it('fails closed when an unseen live file still has a parent in the managed tree', async () => {
    const { rpc } = mockDatabase({ existingDocuments: [knownDocument()] });
    mockDrive({
      getFilePlacement: vi.fn(async () => ({
        trashed: false,
        parents: ['case-folder'],
      })),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Drive listing was inconsistent for file drive-file-1',
    });
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when Drive returns 404 for a live file ancestor', async () => {
    const { rpc } = mockDatabase({ existingDocuments: [knownDocument()] });
    mockDrive({
      getFilePlacement: vi.fn(async (fileId: string) =>
        fileId === 'drive-file-1' ? { trashed: false, parents: ['unknown-parent'] } : null,
      ),
    });

    const result = await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Drive could not verify a file ancestor',
    });
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('treats a 404 for the unseen file itself as confirmed absence', async () => {
    mockDatabase({ existingDocuments: [knownDocument()] });
    mockDrive({ getFilePlacement: vi.fn(async () => null) });

    await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(sweepVanishedDriveFiles).toHaveBeenCalledWith(
      CASE_ID,
      expect.objectContaining({ seenDriveIds: new Set() }),
    );
  });

  it('refuses to scan a missing or mismatched managed case folder', async () => {
    const drive = mockDrive({ isManagedCaseFolder: vi.fn(async () => false) });

    const result = await syncDriveDocumentsForCase(CASE_ID, { deleteVanishedFiles: true });

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'Case Drive folder is missing or does not belong to this case',
    });
    expect(drive.listSubfolders).not.toHaveBeenCalled();
    expect(sweepVanishedDriveFiles).not.toHaveBeenCalled();
  });
});
