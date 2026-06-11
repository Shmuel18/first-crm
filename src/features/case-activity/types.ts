import type { Json } from '@/types/database';

/** One changed field inside a `fields_updated` event (FK values already
 *  substituted with display names by the audit service). */
export type ActivityFieldChange = {
  field: string;
  old: Json | null;
  new: Json | null;
};

/** Entities a generic added/removed/updated event can refer to. Matches the
 *  audit `table_name` so labels reuse the `auditLog.tables.*` translations. */
export type ActivityEntity =
  | 'cases'
  | 'borrowers'
  | 'borrower_incomes'
  | 'borrower_obligations'
  | 'case_banks'
  | 'case_borrowers'
  | 'documents'
  | 'tasks'
  | 'case_financials';

export type ClientEmailKind = 'advisor_message' | 'document_request';

/**
 * One line on the case activity timeline. Discriminated by `kind` — each kind
 * has its own sentence template in `caseActivity.events.*` and its own icon.
 */
export type ActivityEvent = {
  /** Unique per line (audit entries that fan out into several events get a
   *  `:suffix` per event). */
  id: string;
  /** ISO-8601 — the feed is sorted newest-first on this. */
  timestamp: string;
  /** Display name of who did it; null renders as "מערכת". */
  actorName: string | null;
} & ActivityEventBody;

type ActivityEventBody =
  | { kind: 'case_created' }
  | { kind: 'status_changed'; from: string | null; to: string | null }
  | { kind: 'advisor_changed'; from: string | null; to: string | null }
  | { kind: 'borrower_added'; subject: string | null }
  | { kind: 'borrower_removed'; subject: string | null }
  | { kind: 'record_added'; entity: ActivityEntity; subject: string | null }
  | { kind: 'record_removed'; entity: ActivityEntity; subject: string | null }
  | { kind: 'bank_submitted'; subject: string | null }
  | { kind: 'bank_response'; subject: string | null }
  | { kind: 'task_completed'; subject: string | null }
  | { kind: 'document_status'; subject: string | null; status: string | null }
  | {
      kind: 'fields_updated';
      entity: ActivityEntity;
      subject: string | null;
      changes: ActivityFieldChange[];
    }
  | { kind: 'comment_added'; excerpt: string }
  | { kind: 'email_sent'; emailKind: ClientEmailKind; recipient: string; subject: string };

/** Per-case lookup maps the audit→event derivation needs to label events
 *  whose audit row doesn't carry the human name (UPDATEs store diffs only). */
export type ActivityContext = {
  /** borrower_id → display name */
  borrowerNames: ReadonlyMap<string, string>;
  /** borrower_income_id / borrower_obligation_id → owning borrower's name */
  incomeSubjects: ReadonlyMap<string, string>;
  obligationSubjects: ReadonlyMap<string, string>;
  /** document_id → file name */
  documentNames: ReadonlyMap<string, string>;
  /** task_id → title */
  taskTitles: ReadonlyMap<string, string>;
  /** case_bank_id → bank display name */
  bankNames: ReadonlyMap<string, string>;
};

/** Raw row shape for public.client_email_log (migration 163). Declared locally
 *  because the table lands in the generated Database types only after the
 *  migration is applied + types are regenerated (same as case_comments). */
export type ClientEmailLogRow = {
  id: string;
  case_id: string;
  kind: ClientEmailKind;
  recipient_email: string;
  subject: string;
  body: string;
  sent_by: string | null;
  created_at: string;
};
