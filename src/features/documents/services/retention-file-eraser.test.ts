import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRetentionPurgeEnabled } from '@/features/documents/services/erasure-freshness.service';
import {
  eraseDriveTargets,
  getDriveClientIfConnected,
} from '@/features/integrations/services/drive-case-uploader';
import type { GoogleDriveClient } from '@/features/integrations/services/google-drive';
import { createAdminClient } from '@/lib/supabase/admin';

import { eraseRetiredFiles } from './retention-file-eraser';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/features/documents/services/erasure-freshness.service', () => ({
  isRetentionPurgeEnabled: vi.fn(),
}));
vi.mock('@/features/integrations/services/drive-case-uploader', () => ({
  eraseDriveTargets: vi.fn(),
  getDriveClientIfConnected: vi.fn(),
}));
vi.mock('@/features/documents/services/documents.service', () => ({
  DOCUMENTS_BUCKET: 'case-documents',
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

type DbResult = { data: unknown[] | null; error: { message: string } | null };

function listQuery(result: DbResult) {
  const query = {
    not: vi.fn(),
    lt: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  query.not.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function mockRetentionAdmin(input: {
  documents?: unknown[];
  cases?: unknown[];
  expenses?: unknown[];
}) {
  const documentPointerUpdates = vi.fn();
  const expensePointerUpdates = vi.fn();
  const documentRows = input.documents ?? [];
  const caseRows = input.cases ?? [];
  const expenseRows = input.expenses ?? [];

  const from = vi.fn((table: string) => {
    if (table === 'office_settings') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { deleted_records_retention_days: 14 },
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === 'cases') {
      return {
        select: (columns: string) => {
          if (columns === 'id') return listQuery({ data: [], error: null });
          if (columns === 'id, metadata') {
            return { in: () => Promise.resolve({ data: caseRows, error: null }) };
          }
          throw new Error(`unexpected cases select: ${columns}`);
        },
      };
    }
    if (table === 'documents') {
      return {
        select: () => listQuery({ data: documentRows, error: null }),
        update: (values: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {};
          const updateQuery = {
            eq: (column: string, value: unknown) => {
              filters[column] = value;
              return updateQuery;
            },
            select: () => {
              documentPointerUpdates(values, filters);
              return Promise.resolve({ data: [{ id: filters.id }], error: null });
            },
          };
          return updateQuery;
        },
      };
    }
    if (table === 'case_expenses') {
      return {
        select: () => listQuery({ data: expenseRows, error: null }),
        update: (values: Record<string, unknown>) => ({
          in: (_column: string, ids: string[]) => {
            expensePointerUpdates(values, ids);
            return Promise.resolve({ error: null });
          },
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  const remove = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    storage: { from: () => ({ remove }) },
  } as unknown as ReturnType<typeof createAdminClient>);
  return { documentPointerUpdates, expensePointerUpdates };
}

function mockDriveClient(
  placements: Record<
    string,
    { trashed: boolean; parents: string[]; name: string | null; mimeType: string | null } | null
  >,
) {
  const getFilePlacement = vi.fn(async (id: string) => placements[id] ?? null);
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const isManagedCaseFolder = vi.fn(async () => true);
  vi.mocked(getDriveClientIfConnected).mockResolvedValue({
    getFilePlacement,
    deleteFile,
    isManagedCaseFolder,
  } as unknown as GoogleDriveClient);
  return { getFilePlacement, deleteFile, isManagedCaseFolder };
}

const RETAINED_DOCUMENT = {
  id: 'doc-1',
  case_id: 'case-1',
  metadata: null,
  drive_file_id: 'drive-file-1',
};
const CASE_WITH_DRIVE_FOLDER = {
  id: 'case-1',
  metadata: { drive: { case_folder_id: 'case-folder-1' } },
};
const PDF_MIME = 'application/pdf';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

describe('eraseRetiredFiles — retention switch (R4-legal-5)', () => {
  it('returns paused and touches NOTHING (no DB/Storage/Drive) when the switch is off', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(false);

    const res = await eraseRetiredFiles();

    expect(res).toEqual({ ok: true, paused: true });
    // Gated before any admin client is created → no Storage remove, no pointer null.
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe('eraseRetiredFiles — ancestry-safe document Drive retention', () => {
  it('detaches a live file moved outside the original case tree without deleting it', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    const { deleteFile } = mockDriveClient({
      'drive-file-1': {
        trashed: false,
        parents: ['outside-folder'],
        name: 'moved.pdf',
        mimeType: PDF_MIME,
      },
      'outside-folder': {
        trashed: false,
        parents: [],
        name: 'Outside',
        mimeType: FOLDER_MIME,
      },
    });

    const result = await eraseRetiredFiles();

    expect(deleteFile).not.toHaveBeenCalled();
    expect(documentPointerUpdates).toHaveBeenCalledWith(
      { drive_file_id: null, drive_file_url: null },
      { id: 'doc-1', drive_file_id: 'drive-file-1' },
    );
    expect(result).toMatchObject({
      ok: true,
      documents: { driveDeleted: 0, driveDisconnected: false },
    });
  });

  it('leaves every pointer when the stored case folder is not managed by that case', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    const drive = mockDriveClient({
      'drive-file-1': {
        trashed: false,
        parents: ['case-folder-1'],
        name: 'must-stay.pdf',
        mimeType: PDF_MIME,
      },
    });
    drive.isManagedCaseFolder.mockResolvedValue(false);

    const result = await eraseRetiredFiles();

    expect(drive.getFilePlacement).not.toHaveBeenCalled();
    expect(drive.deleteFile).not.toHaveBeenCalled();
    expect(documentPointerUpdates).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, documents: { driveDeleted: 0 } });
  });

  it('deletes a live nested file only after ancestry reaches the original case folder', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    const { deleteFile } = mockDriveClient({
      'drive-file-1': {
        trashed: false,
        parents: ['nested-folder'],
        name: 'inside.pdf',
        mimeType: PDF_MIME,
      },
      'nested-folder': {
        trashed: false,
        parents: ['case-folder-1'],
        name: 'Nested',
        mimeType: FOLDER_MIME,
      },
    });

    const result = await eraseRetiredFiles();

    expect(deleteFile).toHaveBeenCalledWith('drive-file-1');
    expect(documentPointerUpdates).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, documents: { driveDeleted: 1 } });
  });

  it('rechecks shared folder ancestry for every irreversible file delete', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [
        RETAINED_DOCUMENT,
        { ...RETAINED_DOCUMENT, id: 'doc-2', drive_file_id: 'drive-file-2' },
      ],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    let sharedFolderReads = 0;
    const getFilePlacement = vi.fn(async (id: string) => {
      if (id === 'drive-file-1' || id === 'drive-file-2') {
        return {
          trashed: false,
          parents: ['shared-folder'],
          name: `${id}.pdf`,
          mimeType: PDF_MIME,
        };
      }
      if (id === 'shared-folder') {
        sharedFolderReads += 1;
        return {
          trashed: false,
          parents: sharedFolderReads === 1 ? ['case-folder-1'] : [],
          name: 'Moved between documents',
          mimeType: FOLDER_MIME,
        };
      }
      return null;
    });
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({
      getFilePlacement,
      deleteFile,
      isManagedCaseFolder: vi.fn(async () => true),
    } as unknown as GoogleDriveClient);

    const result = await eraseRetiredFiles();

    expect(sharedFolderReads).toBe(2);
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith('drive-file-1');
    expect(documentPointerUpdates).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, documents: { driveDeleted: 1 } });
  });

  it.each([
    ['missing', null],
    [
      'trashed',
      {
        trashed: true,
        parents: ['case-folder-1'],
        name: 'gone.pdf',
        mimeType: PDF_MIME,
      },
    ],
  ])('treats a %s target as gone and clears the pointer without DELETE', async (_label, target) => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    const { deleteFile } = mockDriveClient({ 'drive-file-1': target });

    await eraseRetiredFiles();

    expect(deleteFile).not.toHaveBeenCalled();
    expect(documentPointerUpdates).toHaveBeenCalledTimes(1);
  });

  it('fails closed when an ancestor is unknown and leaves the pointer for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    const { deleteFile } = mockDriveClient({
      'drive-file-1': {
        trashed: false,
        parents: ['inaccessible-folder'],
        name: 'unknown.pdf',
        mimeType: PDF_MIME,
      },
      'inaccessible-folder': null,
    });

    await eraseRetiredFiles();

    expect(deleteFile).not.toHaveBeenCalled();
    expect(documentPointerUpdates).not.toHaveBeenCalled();
  });

  it('fails closed on a Drive verification error and leaves the pointer for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
    });
    const { getFilePlacement, deleteFile } = mockDriveClient({});
    getFilePlacement.mockRejectedValueOnce(new Error('Drive rate limited'));

    await eraseRetiredFiles();

    expect(deleteFile).not.toHaveBeenCalled();
    expect(documentPointerUpdates).not.toHaveBeenCalled();
  });
});

describe('eraseRetiredFiles — expense compatibility', () => {
  it('keeps the existing expense Drive erasure path unchanged', async () => {
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { expensePointerUpdates } = mockRetentionAdmin({
      expenses: [{ id: 'expense-1', receipt_path: null, receipt_drive_id: 'receipt-1' }],
    });
    vi.mocked(eraseDriveTargets).mockResolvedValue({
      connected: true,
      deleted: ['receipt-1'],
      failed: [],
    });

    const result = await eraseRetiredFiles();

    expect(eraseDriveTargets).toHaveBeenCalledWith({ fileIds: ['receipt-1'] });
    expect(expensePointerUpdates).toHaveBeenCalledWith({ receipt_drive_id: null }, ['expense-1']);
    expect(getDriveClientIfConnected).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, expenses: { driveDeleted: 1 } });
  });

  it('still erases expenses when document Drive connection lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(isRetentionPurgeEnabled).mockResolvedValue(true);
    const { documentPointerUpdates, expensePointerUpdates } = mockRetentionAdmin({
      documents: [RETAINED_DOCUMENT],
      cases: [CASE_WITH_DRIVE_FOLDER],
      expenses: [{ id: 'expense-1', receipt_path: null, receipt_drive_id: 'receipt-1' }],
    });
    vi.mocked(getDriveClientIfConnected).mockRejectedValue(new Error('integration lookup failed'));
    vi.mocked(eraseDriveTargets).mockResolvedValue({
      connected: true,
      deleted: ['receipt-1'],
      failed: [],
    });

    const result = await eraseRetiredFiles();

    expect(documentPointerUpdates).not.toHaveBeenCalled();
    expect(expensePointerUpdates).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      documents: { driveDeleted: 0 },
      expenses: { driveDeleted: 1 },
    });
  });
});
