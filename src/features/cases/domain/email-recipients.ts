import { formatPersonName } from '@/lib/utils/person-name';

/**
 * One person on the case who can receive email. The advisor picks from these
 * in the compose dialog, and the server re-derives the same list to validate
 * the choice — a recipient id that isn't on the case is never sent to.
 */
export type EmailRecipient = {
  borrowerId: string;
  /** Display name, office convention (family name first). */
  name: string;
  /** Given name only — greetings read better with it (see formatPersonName). */
  firstName: string | null;
  email: string;
  isPrimary: boolean;
};

/** The join row shape both the page query and the service query produce. */
export type BorrowerEmailRow = {
  is_primary: boolean;
  borrower: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    deleted_at?: string | null;
  } | null;
};

/**
 * Everyone on the case with an address on file, the flagged primary first.
 *
 * Deliberately NOT "the primary borrower's email": a couple often registers
 * one shared address under the second borrower, and keying every client email
 * off `cases.primary_borrower_id` blocked those cases entirely.
 */
export function buildEmailRecipients(rows: ReadonlyArray<BorrowerEmailRow>): EmailRecipient[] {
  const recipients = rows.flatMap((row) => {
    const b = row.borrower;
    const email = b?.email?.trim();
    if (!b || !email || b.deleted_at) return [];
    const name = formatPersonName(b.first_name, b.last_name);
    return [{ borrowerId: b.id, name, firstName: b.first_name, email, isPrimary: row.is_primary }];
  });
  // Primary first — it is both the default selection in the dialog and the
  // fallback the server picks when the caller sends no explicit choice.
  return recipients.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

/**
 * Who a freshly opened compose dialog is addressed to: the primary borrower,
 * or the first person on the case who has an address when the primary has none.
 */
export function defaultRecipientIds(recipients: ReadonlyArray<EmailRecipient>): string[] {
  const first = recipients[0];
  return first ? [first.borrowerId] : [];
}

/** The selected recipients, in list order. */
export function selectedRecipients(
  recipients: ReadonlyArray<EmailRecipient>,
  selectedIds: ReadonlyArray<string>,
): EmailRecipient[] {
  return recipients.filter((r) => selectedIds.includes(r.borrowerId));
}
