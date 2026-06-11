import { listAuditEntriesForCase, type AuditEntry } from '@/features/audit/services/audit.service';
import { listCaseComments } from '@/features/case-comments/services/case-comments.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

import { commentToEvent, emailToEvent, sortEventsDesc } from '../domain/activity-merge';
import { deriveAuditEvents } from '../domain/derive-audit-events';

import { listClientEmailLog } from './client-email-log.service';

import type { ActivityContext, ActivityEvent } from '../types';

// The audit fetch is already capped at 200; comments+emails add a bit on top.
const MAX_EVENTS = 300;

export type CaseActivityResult = {
  /** Curated human timeline (the "פעילות" tab). */
  events: ActivityEvent[];
  /** The raw audit entries the events were derived from (the "יומן מלא" tab) —
   *  returned too so the page renders both tabs from ONE audit fetch. */
  auditEntries: AuditEntry[];
};

/**
 * Everything that happened on a case, merged into one timeline: audit-derived
 * events (status moves, edits, uploads, bank submissions…), team comments and
 * logged client emails. Caller must have verified the case is viewable first
 * (e.g. getCaseById returning truthy) — the audit read is service-role.
 */
export async function listCaseActivity(
  caseId: CaseId,
  opts: { includeFinancials?: boolean } = {},
): Promise<CaseActivityResult> {
  const [auditEntries, comments, emails, ctx] = await Promise.all([
    listAuditEntriesForCase(caseId, undefined, opts),
    listCaseComments(caseId),
    listClientEmailLog(caseId),
    fetchActivityContext(caseId),
  ]);

  const events = sortEventsDesc([
    ...deriveAuditEvents(auditEntries, ctx),
    ...comments.map(commentToEvent),
    ...emails.map((e) => emailToEvent(e.row, e.senderName)),
  ]).slice(0, MAX_EVENTS);

  return { events, auditEntries };
}

/**
 * Display-name lookup maps for the derivation: audit UPDATE rows carry only
 * the diff, so the human label (borrower name, file name, task title, bank)
 * comes from the live rows. Soft-deleted rows are included on purpose — their
 * history should still read by name.
 */
async function fetchActivityContext(caseId: string): Promise<ActivityContext> {
  const admin = createAdminClient();
  // Task titles go through the VIEWER's client — private tasks (is_private,
  // tasks_select RLS) must not leak their title into the feed. Mirrors the
  // task-id filtering in listAuditEntriesForCase.
  const viewer = await createClient();

  const [cbRes, docsRes, tasksRes, banksRes] = await Promise.all([
    admin
      .from('case_borrowers')
      .select('borrower_id, borrower:borrowers(first_name, last_name)')
      .eq('case_id', caseId),
    admin.from('documents').select('id, file_name').eq('case_id', caseId),
    viewer.from('tasks').select('id, title').eq('case_id', caseId),
    admin.from('case_banks').select('id, bank:banks(name_he)').eq('case_id', caseId),
  ]);

  const borrowerNames = new Map<string, string>();
  for (const r of cbRes.data ?? []) {
    const name = formatPersonName(r.borrower?.first_name, r.borrower?.last_name);
    if (typeof r.borrower_id === 'string' && name) borrowerNames.set(r.borrower_id, name);
  }

  const documentNames = new Map<string, string>();
  for (const r of docsRes.data ?? []) documentNames.set(r.id, r.file_name);

  const taskTitles = new Map<string, string>();
  for (const r of tasksRes.data ?? []) taskTitles.set(r.id, r.title);

  const bankNames = new Map<string, string>();
  for (const r of banksRes.data ?? []) {
    if (r.bank?.name_he) bankNames.set(r.id, r.bank.name_he);
  }

  // Incomes/obligations live one hop further — label them with the borrower.
  const borrowerIds = [...borrowerNames.keys()];
  const empty = { data: [] as Array<{ id: string; borrower_id: string | null }> };
  const [incomesRes, obligationsRes] = await Promise.all([
    borrowerIds.length > 0
      ? admin.from('borrower_incomes').select('id, borrower_id').in('borrower_id', borrowerIds)
      : Promise.resolve(empty),
    borrowerIds.length > 0
      ? admin.from('borrower_obligations').select('id, borrower_id').in('borrower_id', borrowerIds)
      : Promise.resolve(empty),
  ]);

  const incomeSubjects = new Map<string, string>();
  for (const r of incomesRes.data ?? []) {
    const name = r.borrower_id ? borrowerNames.get(r.borrower_id) : undefined;
    if (name) incomeSubjects.set(r.id, name);
  }
  const obligationSubjects = new Map<string, string>();
  for (const r of obligationsRes.data ?? []) {
    const name = r.borrower_id ? borrowerNames.get(r.borrower_id) : undefined;
    if (name) obligationSubjects.set(r.id, name);
  }

  return { borrowerNames, incomeSubjects, obligationSubjects, documentNames, taskTitles, bankNames };
}
