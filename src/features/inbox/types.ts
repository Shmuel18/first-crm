import type { Database } from '@/types/database';

export type EmailInboxRow = Database['public']['Tables']['email_inbox']['Row'];
export type EmailInboxInsert = Database['public']['Tables']['email_inbox']['Insert'];

/** The 7 routing categories of ai-v2-spec.md §3.3. */
export const EMAIL_CATEGORIES = [
  'client_documents',
  'client_message',
  'probable_client',
  'bank',
  'vendor_or_marketing',
  'internal',
  'unclear',
] as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export const EMAIL_STATUSES = [
  'auto_processed',
  'new',
  'needs_review',
  'acknowledged',
  'dismissed',
] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** Inbox page tabs — 'attention' is the default ("דורש טיפול"). */
export type InboxTab = 'attention' | 'all' | 'handled';

export type InboxItem = Omit<EmailInboxRow, 'category' | 'status'> & {
  category: EmailCategory;
  status: EmailStatus;
  case: { id: string; case_number: number | string | null } | null;
};
