import { afterEach, describe, expect, it, vi } from 'vitest';

import { eraseDriveTargets } from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';

import { collectCaseFileRefs, eraseCaseFiles, type CaseFileRefs } from './erase-case-files';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/features/documents/services/documents.service', () => ({ DOCUMENTS_BUCKET: 'case-documents' }));
vi.mock('@/features/integrations/services/drive-case-uploader', () => ({ eraseDriveTargets: vi.fn() }));

type Res = { data: unknown; error: { message: string } | null };

function mockAdmin(opts: { docs?: Res; expenses?: Res; caseRow?: Res }) {
  const docs = opts.docs ?? { data: [], error: null };
  const expenses = opts.expenses ?? { data: [], error: null };
  const caseRow = opts.caseRow ?? { data: null, error: null };
  const from = (table: string) => {
    if (table === 'documents') return { select: () => ({ eq: () => Promise.resolve(docs) }) };
    if (table === 'case_expenses') return { select: () => ({ eq: () => Promise.resolve(expenses) }) };
    if (table === 'cases') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(caseRow) }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  };
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
}

afterEach(() => vi.clearAllMocks());

describe('collectCaseFileRefs — fail-closed (R5-lifecycle-2 follow-up)', () => {
  it('returns ok with refs when every read succeeds', async () => {
    mockAdmin({});
    await expect(collectCaseFileRefs('case-1')).resolves.toEqual({
      ok: true,
      refs: { pointers: [], caseFolderId: null },
    });
  });

  it('FAILS CLOSED when the documents read errors (so the caller will not delete)', async () => {
    mockAdmin({ docs: { data: null, error: { message: 'boom' } } });
    await expect(collectCaseFileRefs('case-1')).resolves.toEqual({ ok: false });
  });

  it('FAILS CLOSED when the expenses read errors', async () => {
    mockAdmin({ expenses: { data: null, error: { message: 'boom' } } });
    await expect(collectCaseFileRefs('case-1')).resolves.toEqual({ ok: false });
  });

  it('FAILS CLOSED when the case (folder) read errors', async () => {
    mockAdmin({ caseRow: { data: null, error: { message: 'boom' } } });
    await expect(collectCaseFileRefs('case-1')).resolves.toEqual({ ok: false });
  });
});

// --- eraseCaseFiles: orphan logging on failure (R5-lifecycle-2) --------------
function mockEraseAdmin(opts: { storageError?: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: opts.storageError ?? null });
  const from = (table: string) => {
    if (table === 'erasure_orphan_log') return { insert };
    throw new Error(`unexpected from ${table}`);
  };
  const storage = { from: () => ({ remove }) };
  vi.mocked(createAdminClient).mockReturnValue({ from, storage } as unknown as ReturnType<
    typeof createAdminClient
  >);
  return { insert, remove };
}

const REFS: CaseFileRefs = {
  pointers: [
    { entity: 'document', rowId: 'doc-1', storagePath: 'p/doc1', driveFileId: 'drive-doc1' },
    { entity: 'expense', rowId: 'exp-1', storagePath: 'p/exp1', driveFileId: 'drive-exp1' },
  ],
  caseFolderId: 'folder-1',
};

describe('eraseCaseFiles — orphan logging on failure (R5-lifecycle-2)', () => {
  it('1) Storage failure records an orphan row per leaked Storage pointer', async () => {
    const { insert } = mockEraseAdmin({ storageError: { message: 'boom' } });
    // Drive fully succeeds → only the Storage pointers leak.
    vi.mocked(eraseDriveTargets).mockResolvedValue({
      connected: true,
      deleted: ['drive-doc1', 'drive-exp1', 'folder-1'],
      failed: [],
    });

    await eraseCaseFiles('case-1', REFS);

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'document', row_id: 'doc-1', storage_path: 'p/doc1', drive_file_id: null }),
        expect.objectContaining({ entity: 'expense', row_id: 'exp-1', storage_path: 'p/exp1', drive_file_id: null }),
      ]),
    );
  });

  it('2) Drive not connected records ALL Drive files AND the case folder', async () => {
    const { insert } = mockEraseAdmin({}); // storage ok
    vi.mocked(eraseDriveTargets).mockResolvedValue({ connected: false, deleted: [], failed: [] });

    await eraseCaseFiles('case-1', REFS);

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'document', row_id: 'doc-1', drive_file_id: 'drive-doc1' }),
        expect.objectContaining({ entity: 'expense', row_id: 'exp-1', drive_file_id: 'drive-exp1' }),
        expect.objectContaining({ entity: 'case', row_id: 'case-1', drive_file_id: 'folder-1' }),
      ]),
    );
  });

  it('3) partial Drive failure records ONLY the failed reference (folder + deleted ones excluded)', async () => {
    const { insert } = mockEraseAdmin({}); // storage ok
    // drive-doc1 + the folder erased; drive-exp1 failed.
    vi.mocked(eraseDriveTargets).mockResolvedValue({
      connected: true,
      deleted: ['drive-doc1', 'folder-1'],
      failed: ['drive-exp1'],
    });

    await eraseCaseFiles('case-1', REFS);

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      expect.objectContaining({ entity: 'expense', row_id: 'exp-1', drive_file_id: 'drive-exp1' }),
    ]);
    expect(rows).toHaveLength(1);
  });

  it('writes no orphan rows when every file is erased', async () => {
    const { insert } = mockEraseAdmin({}); // storage ok
    vi.mocked(eraseDriveTargets).mockResolvedValue({
      connected: true,
      deleted: ['drive-doc1', 'drive-exp1', 'folder-1'],
      failed: [],
    });

    await eraseCaseFiles('case-1', REFS);

    expect(insert).not.toHaveBeenCalled();
  });
});
