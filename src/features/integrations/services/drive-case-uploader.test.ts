import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '@/lib/supabase/server';

import type { IntegrationRow } from '../types';
import { moveCaseDocumentToDriveFolder } from './drive-case-uploader';
import { GoogleDriveClient } from './google-drive';
import { getIntegration } from './integrations.service';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('./google-oauth', () => ({
  refreshAccessToken: vi.fn(),
  RefreshTokenError: class RefreshTokenError extends Error {
    permanent = false;
  },
}));
vi.mock('./integrations.service', () => ({
  getIntegration: vi.fn(),
  markIntegrationDisconnected: vi.fn(),
  persistDriveRootFolderId: vi.fn(),
  persistRefreshedAccessToken: vi.fn(),
}));

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function mockCaseMeta(subfolderId = 'cached-income-folder') {
  const caseQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: {
        metadata: {
          drive: {
            case_folder_id: 'case-root',
            subfolders: { income_il: subfolderId },
          },
        },
      },
      error: null,
    })),
  };
  caseQuery.select.mockReturnValue(caseQuery);
  caseQuery.eq.mockReturnValue(caseQuery);
  const rpc = vi.fn(async () => ({ data: null, error: null }));

  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => caseQuery),
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { rpc };
}

beforeEach(() => {
  vi.mocked(getIntegration).mockResolvedValue({
    provider: 'google_drive',
    status: 'connected',
    refresh_token: 'refresh-token',
    access_token: 'access-token',
    token_expires_at: '2099-01-01T00:00:00.000Z',
  } as IntegrationRow);
  vi.spyOn(GoogleDriveClient.prototype, 'isManagedCaseFolder').mockResolvedValue(true);
  vi.spyOn(GoogleDriveClient.prototype, 'moveFile').mockResolvedValue({
    changed: true,
    previousParents: ['case-root'],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('moveCaseDocumentToDriveFolder', () => {
  it('keeps a renamed stable category folder and mirrors its current Drive path', async () => {
    mockCaseMeta();
    const placement = vi
      .spyOn(GoogleDriveClient.prototype, 'getFilePlacement')
      .mockResolvedValueOnce({
        trashed: false,
        parents: ['case-root'],
        name: 'document.pdf',
        mimeType: 'application/pdf',
      })
      .mockResolvedValue({
        trashed: false,
        parents: ['case-root'],
        name: 'הכנסות 2026',
        mimeType: FOLDER_MIME,
      });
    const ensureFolder = vi.spyOn(GoogleDriveClient.prototype, 'ensureFolder');

    await expect(
      moveCaseDocumentToDriveFolder({
        caseId: CASE_ID,
        driveFileId: 'drive-file-1',
        driveFolder: 'income_il',
      }),
    ).resolves.toEqual({
      ok: true,
      changed: true,
      previousParents: ['case-root'],
      targetFolderId: 'cached-income-folder',
      targetFolderName: 'הכנסות 2026',
    });

    expect(placement).toHaveBeenCalledTimes(3);
    expect(ensureFolder).not.toHaveBeenCalled();
    expect(GoogleDriveClient.prototype.moveFile).toHaveBeenCalledWith(
      'drive-file-1',
      'cached-income-folder',
    );
  });

  it('replaces a cached folder id that is no longer a direct child of the case', async () => {
    const { rpc } = mockCaseMeta('stale-income-folder');
    vi.spyOn(GoogleDriveClient.prototype, 'getFilePlacement')
      .mockResolvedValueOnce({
        trashed: false,
        parents: ['case-root'],
        name: 'document.pdf',
        mimeType: 'application/pdf',
      })
      .mockResolvedValueOnce({
        trashed: false,
        parents: ['another-case'],
        name: '02_תעסוקה_והכנסות',
        mimeType: FOLDER_MIME,
      })
      .mockResolvedValueOnce({
        trashed: false,
        parents: ['case-root'],
        name: '02_תעסוקה_והכנסות',
        mimeType: FOLDER_MIME,
      });
    const ensureFolder = vi
      .spyOn(GoogleDriveClient.prototype, 'ensureFolder')
      .mockResolvedValue('fresh-income-folder');

    const result = await moveCaseDocumentToDriveFolder({
      caseId: CASE_ID,
      driveFileId: 'drive-file-1',
      driveFolder: 'income_il',
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, targetFolderId: 'fresh-income-folder' }),
    );
    expect(ensureFolder).toHaveBeenCalledWith('02_תעסוקה_והכנסות', 'case-root');
    expect(rpc).toHaveBeenCalledWith('update_case_drive_meta', {
      p_case_id: CASE_ID,
      p_patch: { subfolders: { income_il: 'fresh-income-folder' } },
    });
    expect(GoogleDriveClient.prototype.moveFile).toHaveBeenCalledWith(
      'drive-file-1',
      'fresh-income-folder',
    );
  });

  it('refuses to pull a stale document back from another case', async () => {
    mockCaseMeta();
    vi.spyOn(GoogleDriveClient.prototype, 'getFilePlacement')
      .mockResolvedValueOnce({
        trashed: false,
        parents: ['other-case-folder'],
        name: 'document.pdf',
        mimeType: 'application/pdf',
      })
      .mockResolvedValueOnce({
        trashed: false,
        parents: [],
        name: 'Other case',
        mimeType: FOLDER_MIME,
      });

    await expect(
      moveCaseDocumentToDriveFolder({
        caseId: CASE_ID,
        driveFileId: 'drive-file-1',
        driveFolder: 'income_il',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'error',
      message: 'Drive file is no longer inside this case folder',
    });
    expect(GoogleDriveClient.prototype.moveFile).not.toHaveBeenCalled();
  });
});
