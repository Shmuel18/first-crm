import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationRow } from '../types';
import { GoogleDriveClient } from './google-drive';

vi.mock('./google-oauth', () => ({
  refreshAccessToken: vi.fn(),
  RefreshTokenError: class RefreshTokenError extends Error {
    permanent = false;
  },
}));
vi.mock('./integrations.service', () => ({
  markIntegrationDisconnected: vi.fn(),
  persistRefreshedAccessToken: vi.fn(),
}));
vi.mock('@/lib/http/with-timeout', () => ({
  timeoutSignal: vi.fn(() => new AbortController().signal),
}));

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function client() {
  return new GoogleDriveClient({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_expires_at: '2099-01-01T00:00:00.000Z',
    provider: 'google_drive',
  } as IntegrationRow);
}

function driveResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('GoogleDriveClient.isManagedCaseFolder', () => {
  it('accepts only a live folder tagged for the same case', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      driveResponse(200, {
        id: 'folder-1',
        mimeType: FOLDER_MIME,
        trashed: false,
        appProperties: { caseFolderId: CASE_ID },
      }),
    );

    await expect(client().isManagedCaseFolder('folder-1', CASE_ID)).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files/folder-1?fields='),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('rejects a folder tagged for another case', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      driveResponse(200, {
        mimeType: FOLDER_MIME,
        trashed: false,
        appProperties: { caseFolderId: 'another-case' },
      }),
    );

    await expect(client().isManagedCaseFolder('folder-1', CASE_ID)).resolves.toBe(false);
  });

  it('rejects a trashed or missing folder', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        driveResponse(200, {
          mimeType: FOLDER_MIME,
          trashed: true,
          appProperties: { caseFolderId: CASE_ID },
        }),
      )
      .mockResolvedValueOnce(driveResponse(404));

    await expect(client().isManagedCaseFolder('folder-1', CASE_ID)).resolves.toBe(false);
    await expect(client().isManagedCaseFolder('folder-1', CASE_ID)).resolves.toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('fails loudly when Drive cannot verify the folder', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(driveResponse(403));

    await expect(client().isManagedCaseFolder('folder-1', CASE_ID)).rejects.toThrow(
      'Drive case folder verification failed: 403',
    );
  });
});

describe('GoogleDriveClient.isLiveFile', () => {
  it('distinguishes a live file from a trashed or missing file', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(driveResponse(200, { id: 'file-1', trashed: false }))
      .mockResolvedValueOnce(driveResponse(200, { id: 'file-1', trashed: true }))
      .mockResolvedValueOnce(driveResponse(404));
    const drive = client();

    await expect(drive.isLiveFile('file-1')).resolves.toBe(true);
    await expect(drive.isLiveFile('file-1')).resolves.toBe(false);
    await expect(drive.isLiveFile('file-1')).resolves.toBe(false);
  });

  it('fails loudly when Drive cannot confirm file state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(driveResponse(500));

    await expect(client().isLiveFile('file-1')).rejects.toThrow(
      'Drive file verification failed: 500',
    );
  });
});

describe('GoogleDriveClient.getFilePlacement', () => {
  it('returns parents and trash state, and uses null only for a missing file', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        driveResponse(200, { id: 'file-1', trashed: false, parents: ['folder-1'] }),
      )
      .mockResolvedValueOnce(driveResponse(200, { id: 'file-1', trashed: true }))
      .mockResolvedValueOnce(driveResponse(404));
    const drive = client();

    await expect(drive.getFilePlacement('file-1')).resolves.toEqual({
      trashed: false,
      parents: ['folder-1'],
      name: null,
      mimeType: null,
    });
    await expect(drive.getFilePlacement('file-1')).resolves.toEqual({
      trashed: true,
      parents: [],
      name: null,
      mimeType: null,
    });
    await expect(drive.getFilePlacement('file-1')).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('supportsAllDrives=true'),
      expect.any(Object),
    );
  });

  it('fails loudly when Drive cannot verify placement', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(driveResponse(503));

    await expect(client().getFilePlacement('file-1')).rejects.toThrow(
      'Drive file placement verification failed: 503',
    );
  });
});

describe('GoogleDriveClient.moveFile', () => {
  it('replaces the current parent with the canonical target folder', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        driveResponse(200, {
          id: 'file-1',
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          trashed: false,
          parents: ['case-root'],
        }),
      )
      .mockResolvedValueOnce(driveResponse(200, { id: 'file-1', parents: ['income-folder'] }));

    await expect(client().moveFile('file-1', 'income-folder')).resolves.toEqual({
      changed: true,
      previousParents: ['case-root'],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[1]!;
    expect(url).toEqual(expect.stringContaining('addParents=income-folder'));
    expect(url).toEqual(expect.stringContaining('removeParents=case-root'));
    expect(url).toEqual(expect.stringContaining('supportsAllDrives=true'));
    expect(init).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: '{}',
      }),
    );
  });

  it('does not mutate Drive when the file already has exactly the target parent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      driveResponse(200, {
        id: 'file-1',
        trashed: false,
        parents: ['income-folder'],
      }),
    );

    await expect(client().moveFile('file-1', 'income-folder')).resolves.toEqual({
      changed: false,
      previousParents: ['income-folder'],
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('fails closed for a missing or trashed file', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(driveResponse(404))
      .mockResolvedValueOnce(driveResponse(200, { trashed: true, parents: ['case-root'] }));
    const drive = client();

    await expect(drive.moveFile('missing', 'income-folder')).rejects.toThrow(
      'Drive file move failed: file is missing or trashed',
    );
    await expect(drive.moveFile('trashed', 'income-folder')).rejects.toThrow(
      'Drive file move failed: file is missing or trashed',
    );
  });
});

describe('GoogleDriveClient.deleteFile', () => {
  it('deletes Shared Drive files with supportsAllDrives enabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(driveResponse(204));

    await client().deleteFile('file-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files/file-1?supportsAllDrives=true'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('GoogleDriveClient recursive listings', () => {
  it('includes Shared Drive flags on file and subfolder list requests', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => driveResponse(200, { files: [] }));
    const drive = client();

    await drive.listFolderFilesPaginated('folder-1');
    await drive.listSubfolders('folder-1');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    for (const [url] of fetchSpy.mock.calls) {
      expect(url).toEqual(expect.stringContaining('supportsAllDrives=true'));
      expect(url).toEqual(expect.stringContaining('includeItemsFromAllDrives=true'));
    }
  });
});

describe('GoogleDriveClient download responses', () => {
  it('leaves regular Drive bytes as a readable response stream', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('drive-bytes', { status: 200 }));

    const response = await client().downloadFileResponse('file-1');

    await expect(response.text()).resolves.toBe('drive-bytes');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files/file-1?alt=media'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('streams a Google-native export using the requested encoded MIME type', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('office-export', { status: 200 }));

    const response = await client().exportFileResponse(
      'google-sheet-1',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    await expect(response.text()).resolves.toBe('office-export');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '/files/google-sheet-1/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('keeps the PDF response wrapper for printing and email callers', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('pdf-export', { status: 200 }));

    const response = await client().exportFileAsPdfResponse('google-doc-1');

    await expect(response.text()).resolves.toBe('pdf-export');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files/google-doc-1/export?mimeType=application%2Fpdf'),
      expect.any(Object),
    );
  });
});
