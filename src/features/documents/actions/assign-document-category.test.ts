import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  moveCaseDocumentToDriveFolder,
  restoreCaseDocumentDriveParent,
} from '@/features/integrations/services/drive-case-uploader';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { assignDocumentCategoryAction } from './assign-document-category';

vi.mock('@/features/integrations/services/drive-case-uploader', () => ({
  moveCaseDocumentToDriveFolder: vi.fn(),
  restoreCaseDocumentDriveParent: vi.fn(),
}));
vi.mock('@/lib/auth/permissions', () => ({
  userCanEditCase: vi.fn(),
  userHasPermission: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

type DbResult = { data: unknown; error: { code?: string; message: string } | null };

function query(result: DbResult) {
  const chain = {
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}

function mockDb(options?: {
  driveFileId?: string | null;
  documentMetadata?: Record<string, unknown>;
  documentResult?: DbResult;
  categoryResult?: DbResult;
  updateResult?: DbResult;
}) {
  const documentQuery = query(
    options?.documentResult ?? {
      data: {
        id: DOCUMENT_ID,
        drive_file_id: options?.driveFileId === undefined ? 'drive-file-1' : options.driveFileId,
        metadata: options?.documentMetadata ?? { source: 'drive_sync', keep_me: true },
      },
      error: null,
    },
  );
  const categoryQuery = query(
    options?.categoryResult ?? {
      data: { id: CATEGORY_ID, drive_folder: 'income_il' },
      error: null,
    },
  );
  const updateQuery = query(options?.updateResult ?? { data: { id: DOCUMENT_ID }, error: null });
  const documentsTable = {
    select: vi.fn(() => documentQuery),
    update: vi.fn(() => updateQuery),
  };
  const categoriesTable = { select: vi.fn(() => categoryQuery) };
  const from = vi.fn((table: string) => (table === 'documents' ? documentsTable : categoriesTable));

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } } })),
    },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { documentsTable, updateQuery };
}

beforeEach(() => {
  vi.mocked(userHasPermission).mockResolvedValue(true);
  vi.mocked(userCanEditCase).mockResolvedValue(true);
  vi.mocked(moveCaseDocumentToDriveFolder).mockResolvedValue({
    ok: true,
    changed: true,
    previousParents: ['case-root'],
    targetFolderId: 'income-folder',
    targetFolderName: '02_תעסוקה_והכנסות',
  });
  vi.mocked(restoreCaseDocumentDriveParent).mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('assignDocumentCategoryAction', () => {
  it('moves a Drive-backed file before updating category and mirrored location', async () => {
    const { documentsTable } = mockDb();

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: true,
    });

    expect(moveCaseDocumentToDriveFolder).toHaveBeenCalledWith({
      caseId: CASE_ID,
      driveFileId: 'drive-file-1',
      driveFolder: 'income_il',
    });
    expect(documentsTable.update).toHaveBeenCalledWith({
      category_id: CATEGORY_ID,
      metadata: {
        source: 'drive_sync',
        keep_me: true,
        drive_parent_folder_id: 'income-folder',
        drive_relative_path: ['02_תעסוקה_והכנסות'],
      },
    });
    expect(vi.mocked(moveCaseDocumentToDriveFolder).mock.invocationCallOrder[0]!).toBeLessThan(
      documentsTable.update.mock.invocationCallOrder[0]!,
    );
    expect(restoreCaseDocumentDriveParent).not.toHaveBeenCalled();
  });

  it('does not claim a category change when the Drive move fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(moveCaseDocumentToDriveFolder).mockResolvedValue({
      ok: false,
      reason: 'error',
      message: 'Drive file move failed: 403',
    });
    const { documentsTable } = mockDb();

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: false,
      error: 'unknown',
    });

    expect(documentsTable.update).not.toHaveBeenCalled();
  });

  it('compensates the Drive move when the guarded DB update fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDb({
      updateResult: { data: null, error: { code: '08006', message: 'connection failure' } },
    });

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: false,
      error: 'unknown',
    });

    expect(restoreCaseDocumentDriveParent).toHaveBeenCalledWith({
      driveFileId: 'drive-file-1',
      expectedCurrentParentId: 'income-folder',
      previousParents: ['case-root'],
    });
  });

  it('updates a storage-only document without making a Drive call', async () => {
    const { documentsTable } = mockDb({
      driveFileId: null,
      documentMetadata: { storage_path: 'cases/file.pdf' },
    });

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: true,
    });

    expect(moveCaseDocumentToDriveFolder).not.toHaveBeenCalled();
    expect(documentsTable.update).toHaveBeenCalledWith({ category_id: CATEGORY_ID });
  });

  it('rejects inactive/missing categories without mutating anything', async () => {
    const { documentsTable } = mockDb({
      categoryResult: { data: null, error: null },
    });

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: false,
      error: 'validation',
    });

    expect(moveCaseDocumentToDriveFolder).not.toHaveBeenCalled();
    expect(documentsTable.update).not.toHaveBeenCalled();
  });

  it('checks case edit authority before reading or moving the document', async () => {
    vi.mocked(userCanEditCase).mockResolvedValue(false);
    const { documentsTable } = mockDb();

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    });

    expect(documentsTable.select).not.toHaveBeenCalled();
    expect(moveCaseDocumentToDriveFolder).not.toHaveBeenCalled();
  });

  it('requires upload permission now that document verification is not a workflow', async () => {
    vi.mocked(userHasPermission).mockResolvedValue(false);
    const { documentsTable } = mockDb();

    await expect(assignDocumentCategoryAction(DOCUMENT_ID, CASE_ID, CATEGORY_ID)).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    });

    expect(documentsTable.select).not.toHaveBeenCalled();
    expect(moveCaseDocumentToDriveFolder).not.toHaveBeenCalled();
  });

  it('rejects malformed identifiers before opening a session', async () => {
    await expect(assignDocumentCategoryAction('not-a-uuid', CASE_ID, CATEGORY_ID)).resolves.toEqual(
      { ok: false, error: 'validation' },
    );

    expect(createClient).not.toHaveBeenCalled();
  });
});
