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
