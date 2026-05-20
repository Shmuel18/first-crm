export type BackupFileMeta = {
  id: string;
  name: string;
  size: number | null;
  webViewLink: string;
  createdTime: string;
};

export type BackupView = {
  oauthConfigured: boolean;
  driveConnected: boolean;
  backups: BackupFileMeta[];
};

export type RunBackupResult =
  | { ok: true; filename: string; webViewLink: string; totalRows: number }
  | { ok: false; error: 'unauthorized' | 'not_connected' | 'unknown'; message?: string };
