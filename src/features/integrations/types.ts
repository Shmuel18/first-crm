import type { Database } from '@/types/database';

export type IntegrationRow =
  Database['public']['Tables']['office_integrations']['Row'];

export type IntegrationProvider =
  | 'google_drive'
  | 'google_calendar'
  | 'whatsapp'
  | 'resend';

export type IntegrationStatus = 'disconnected' | 'connected' | 'error';

export type IntegrationSummary = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedEmail: string | null;
  connectedAt: string | null;
  scopes: string[];
  lastError: string | null;
};

/** Public Drive integration view (token fields excluded). */
export type DriveIntegrationView = IntegrationSummary & {
  rootFolderId: string | null;
  rootFolderName: string;
};
