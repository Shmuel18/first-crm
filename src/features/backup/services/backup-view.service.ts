import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { getDriveIntegrationView } from '@/features/integrations/services/integrations.service';
import { isGoogleOAuthConfigured } from '@/lib/env';

import { findBackupFolder, listBackups } from './drive-backup.service';

import type { BackupView } from '../types';

export async function getBackupView(): Promise<BackupView> {
  const oauthConfigured = isGoogleOAuthConfigured();
  const view = await getDriveIntegrationView();
  const driveConnected = view.status === 'connected';

  if (!driveConnected) {
    return { oauthConfigured, driveConnected, backups: [] };
  }

  // Drive may still fail (expired refresh token, transient API error) — never
  // let it break the settings page; the panel can still offer a backup attempt.
  try {
    const client = await getDriveClientIfConnected();
    if (!client) return { oauthConfigured, driveConnected: false, backups: [] };
    const folderId = await findBackupFolder(client);
    const backups = folderId ? await listBackups(client, folderId) : [];
    return { oauthConfigured, driveConnected, backups };
  } catch {
    return { oauthConfigured, driveConnected, backups: [] };
  }
}
