import type {
  AuditEntry,
  AuditChangeMap,
  AuditFieldChange,
} from '@/features/audit/domain/audit-parser';
import type { Json } from '@/types/database';

import type { ActivityContext, ActivityEntity, ActivityEvent, ActivityFieldChange } from '../types';

/**
 * Pure translation of case audit entries (FK values already substituted with
 * display names) into human activity events. One audit row can fan out into
 * several events — e.g. a case UPDATE that changes both the status and the
 * notes yields a `status_changed` plus a `fields_updated`.
 */
export function deriveAuditEvents(
  entries: ReadonlyArray<AuditEntry>,
  ctx: ActivityContext,
): ActivityEvent[] {
  return entries.flatMap((e) => eventsFromEntry(e, ctx));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function strOrNull(v: Json | null | undefined): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** FK-substituted values are display names; anything still UUID-shaped failed
 *  to resolve (e.g. a hard-deleted row) — hide it rather than print a UUID. */
function nameOrNull(v: Json | null | undefined): string | null {
  const s = strOrNull(v);
  return s && !UUID_RE.test(s) ? s : null;
}

/** True when this diff sets a previously-empty column (null/'' → value) —
 *  the "it happened now" transition, as opposed to a correction of the date. */
function isNowSet(c: AuditFieldChange | undefined): boolean {
  if (!c) return false;
  const oldEmpty = c.old === null || c.old === '';
  return oldEmpty && c.new !== null && c.new !== '';
}

function residualChanges(
  changes: AuditChangeMap | null,
  exclude: ReadonlyArray<string>,
): ActivityFieldChange[] {
  if (!changes) return [];
  return Object.entries(changes)
    .filter(([field]) => !exclude.includes(field))
    .map(([field, c]) => ({ field, old: c.old, new: c.new }));
}

type Base = Pick<ActivityEvent, 'id' | 'timestamp' | 'actorName'>;
function base(e: AuditEntry, suffix = ''): Base {
  return { id: suffix ? `${e.id}:${suffix}` : e.id, timestamp: e.timestamp, actorName: e.actorName };
}

function fieldsUpdated(
  e: AuditEntry,
  entity: ActivityEntity,
  subject: string | null,
  exclude: ReadonlyArray<string> = [],
): ActivityEvent[] {
  const changes = residualChanges(e.changes, exclude);
  if (changes.length === 0) return [];
  return [{ ...base(e, 'fields'), kind: 'fields_updated', entity, subject, changes }];
}

function eventsFromEntry(e: AuditEntry, ctx: ActivityContext): ActivityEvent[] {
  switch (e.tableName) {
    case 'cases':
      return casesEvents(e);
    case 'case_borrowers':
      return caseBorrowersEvents(e);
    case 'borrowers':
      return borrowersEvents(e, ctx);
    case 'borrower_incomes':
      return childRowEvents(e, 'borrower_incomes', ctx.incomeSubjects);
    case 'borrower_obligations':
      return childRowEvents(e, 'borrower_obligations', ctx.obligationSubjects);
    case 'case_banks':
      return caseBanksEvents(e, ctx);
    case 'documents':
      return documentsEvents(e, ctx);
    case 'tasks':
      return tasksEvents(e, ctx);
    case 'case_financials':
      // INSERT rides along case creation; only the diffs are interesting.
      return e.action === 'UPDATE' ? fieldsUpdated(e, 'case_financials', null) : [];
    default:
      return [];
  }
}

function casesEvents(e: AuditEntry): ActivityEvent[] {
  if (e.action === 'INSERT') return [{ ...base(e), kind: 'case_created' }];
  if (e.action === 'DELETE')
    return [{ ...base(e), kind: 'record_removed', entity: 'cases', subject: null }];

  const ch = e.changes ?? {};
  const out: ActivityEvent[] = [];
  if (ch.status_id) {
    out.push({
      ...base(e, 'status'),
      kind: 'status_changed',
      from: nameOrNull(ch.status_id.old),
      to: nameOrNull(ch.status_id.new),
    });
  }
  if (ch.assigned_advisor_id) {
    out.push({
      ...base(e, 'advisor'),
      kind: 'advisor_changed',
      from: nameOrNull(ch.assigned_advisor_id.old),
      to: nameOrNull(ch.assigned_advisor_id.new),
    });
  }
  out.push(...fieldsUpdated(e, 'cases', null, ['status_id', 'assigned_advisor_id']));
  return out;
}

function caseBorrowersEvents(e: AuditEntry): ActivityEvent[] {
  // The link row is the authoritative "joined / left the case" signal — it
  // also fires when an EXISTING borrower (returning client) is attached,
  // which a `borrowers` INSERT would miss.
  const subject = nameOrNull(e.wholeRow?.borrower_id);
  if (e.action === 'INSERT') return [{ ...base(e), kind: 'borrower_added', subject }];
  if (e.action === 'DELETE') return [{ ...base(e), kind: 'borrower_removed', subject }];
  return fieldsUpdated(e, 'case_borrowers', null);
}

function borrowersEvents(e: AuditEntry, ctx: ActivityContext): ActivityEvent[] {
  // INSERT/DELETE are covered by the case_borrowers link events above.
  if (e.action !== 'UPDATE') return [];
  return fieldsUpdated(e, 'borrowers', ctx.borrowerNames.get(e.recordId) ?? null);
}

function childRowEvents(
  e: AuditEntry,
  entity: ActivityEntity,
  subjects: ReadonlyMap<string, string>,
): ActivityEvent[] {
  const subject = subjects.get(e.recordId) ?? nameOrNull(e.wholeRow?.borrower_id);
  if (e.action === 'INSERT') return [{ ...base(e), kind: 'record_added', entity, subject }];
  if (e.action === 'DELETE') return [{ ...base(e), kind: 'record_removed', entity, subject }];
  return fieldsUpdated(e, entity, subject);
}

function caseBanksEvents(e: AuditEntry, ctx: ActivityContext): ActivityEvent[] {
  const subject = nameOrNull(e.wholeRow?.bank_id) ?? ctx.bankNames.get(e.recordId) ?? null;
  if (e.action === 'INSERT') return [{ ...base(e), kind: 'record_added', entity: 'case_banks', subject }];
  if (e.action === 'DELETE') return [{ ...base(e), kind: 'record_removed', entity: 'case_banks', subject }];

  const ch = e.changes ?? {};
  const out: ActivityEvent[] = [];
  if (isNowSet(ch.submission_date)) out.push({ ...base(e, 'submitted'), kind: 'bank_submitted', subject });
  if (isNowSet(ch.response_date)) out.push({ ...base(e, 'response'), kind: 'bank_response', subject });
  const exclude = [
    ...(isNowSet(ch.submission_date) ? ['submission_date'] : []),
    ...(isNowSet(ch.response_date) ? ['response_date'] : []),
  ];
  out.push(...fieldsUpdated(e, 'case_banks', subject, exclude));
  return out;
}

function documentsEvents(e: AuditEntry, ctx: ActivityContext): ActivityEvent[] {
  const subject =
    strOrNull(e.wholeRow?.file_name) ?? ctx.documentNames.get(e.recordId) ?? null;
  if (e.action === 'INSERT') return [{ ...base(e), kind: 'record_added', entity: 'documents', subject }];
  if (e.action === 'DELETE') return [{ ...base(e), kind: 'record_removed', entity: 'documents', subject }];

  const ch = e.changes ?? {};
  // Soft delete (deleted_at set) IS the removal — don't also list the diff.
  if (isNowSet(ch.deleted_at))
    return [{ ...base(e), kind: 'record_removed', entity: 'documents', subject }];

  const out: ActivityEvent[] = [];
  if (ch.status) {
    out.push({
      ...base(e, 'docstatus'),
      kind: 'document_status',
      subject,
      status: strOrNull(ch.status.new),
    });
  }
  out.push(...fieldsUpdated(e, 'documents', subject, ['status']));
  return out;
}

function tasksEvents(e: AuditEntry, ctx: ActivityContext): ActivityEvent[] {
  const subject = strOrNull(e.wholeRow?.title) ?? ctx.taskTitles.get(e.recordId) ?? null;
  if (e.action === 'INSERT') return [{ ...base(e), kind: 'record_added', entity: 'tasks', subject }];
  if (e.action === 'DELETE') return [{ ...base(e), kind: 'record_removed', entity: 'tasks', subject }];

  const ch = e.changes ?? {};
  if (isNowSet(ch.deleted_at))
    return [{ ...base(e), kind: 'record_removed', entity: 'tasks', subject }];

  const completed = isNowSet(ch.completed_at) || ch.status?.new === 'completed';
  const out: ActivityEvent[] = [];
  if (completed) out.push({ ...base(e, 'completed'), kind: 'task_completed', subject });
  const exclude = completed ? ['completed_at', 'completed_by', 'status'] : [];
  out.push(...fieldsUpdated(e, 'tasks', subject, exclude));
  return out;
}
