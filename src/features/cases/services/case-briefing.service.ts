import 'server-only';

import { listCaseActivity } from '@/features/case-activity/services/case-activity.service';
import { getCaseDocumentChecklist } from '@/features/documents/services/document-checklist.service';
import { listDocumentsForCase } from '@/features/documents/services/documents.service';
import { listTasksForCase } from '@/features/tasks/services/tasks.service';
import { createClient } from '@/lib/supabase/server';
import { asCaseId } from '@/lib/types/branded';

import type { ActivityEvent } from '@/features/case-activity/types';

/**
 * Context assembly for the pre-call case briefing (ai-v2-spec.md §4.1).
 * Runs entirely under the CALLER's client — RLS and the includeFinancials
 * gate keep manager-only data out of a non-manager's briefing (§8.2), and a
 * case the caller can't see simply resolves to null. Financial figures
 * (fees, expected income) are deliberately NEVER part of the context.
 */

export type BriefingContext = {
  caseLabel: string;
  statusName: string | null;
  targetDate: string | null;
  borrowers: string[];
  openTasks: Array<{ title: string; due: string | null }>;
  missingDocs: string[];
  recentActivity: string[];
};

export async function assembleBriefingContext(caseId: string): Promise<BriefingContext | null> {
  const supabase = await createClient();
  const branded = asCaseId(caseId);

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, case_number, target_date, status:case_statuses(name_he)')
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!caseRow) return null; // RLS-filtered or gone — the route 404s

  const [{ data: caseBorrowers }, documents, tasks, activity] = await Promise.all([
    supabase
      .from('case_borrowers')
      .select('borrower:borrowers(first_name, last_name)')
      .eq('case_id', caseId),
    listDocumentsForCase(branded),
    listTasksForCase(branded),
    // Financial diffs stay out of the AI context regardless of who asks.
    listCaseActivity(branded, { includeFinancials: false }),
  ]);

  const checklist = await getCaseDocumentChecklist(branded, documents);
  // PostgREST to-one embed typing gap.
  const status = caseRow.status as unknown as { name_he: string } | null;

  return {
    caseLabel: String(caseRow.case_number ?? caseId),
    statusName: status?.name_he ?? null,
    targetDate: caseRow.target_date,
    borrowers: (caseBorrowers ?? [])
      .map((row) => row.borrower as unknown as { first_name: string | null; last_name: string | null } | null)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => [b.first_name, b.last_name].filter(Boolean).join(' '))
      .filter((name) => name.length > 0),
    openTasks: tasks.slice(0, 8).map((t) => ({ title: t.title, due: t.due_date })),
    missingDocs: checklist
      .filter((item) => item.status === 'missing' || item.status === 'rejected')
      .map((item) => item.nameHe),
    recentActivity: activity.events.slice(0, 10).map(describeEvent).filter((s) => s.length > 0),
  };
}

/** Compact Hebrew line per event — the model summarizes, so terse is fine. */
function describeEvent(e: ActivityEvent): string {
  const when = e.timestamp.slice(0, 10);
  switch (e.kind) {
    case 'case_created':
      return `${when}: התיק נפתח`;
    case 'status_changed':
      return `${when}: סטטוס עבר ל"${e.to ?? '?'}"`;
    case 'advisor_changed':
      return `${when}: הוחלף יועץ אחראי`;
    case 'bank_submitted':
      return `${when}: הוגש לבנק ${e.subject ?? ''}`.trim();
    case 'bank_response':
      return `${when}: התקבלה תשובת בנק ${e.subject ?? ''}`.trim();
    case 'task_completed':
      return `${when}: הושלמה משימה "${e.subject ?? ''}"`;
    case 'document_status':
      return `${when}: מסמך ${e.subject ?? ''} — ${e.status ?? ''}`;
    case 'comment_added':
      return `${when}: הערה — ${e.excerpt}`;
    case 'email_sent':
      return `${when}: נשלח מייל ללקוח — ${e.subject}`;
    case 'record_added':
      return `${when}: נוסף ${e.subject ?? String(e.entity)}`;
    case 'borrower_added':
      return `${when}: נוסף לווה ${e.subject ?? ''}`.trim();
    default:
      return '';
  }
}

/** The context block the route feeds the model. */
export function formatBriefingContext(ctx: BriefingContext): string {
  return [
    `תיק ${ctx.caseLabel} · סטטוס: ${ctx.statusName ?? 'לא ידוע'}${ctx.targetDate ? ` · תאריך יעד: ${ctx.targetDate}` : ''}`,
    `לווים: ${ctx.borrowers.join(', ') || '—'}`,
    '',
    'מסמכים חסרים:',
    ...(ctx.missingDocs.length > 0 ? ctx.missingDocs.map((d) => `- ${d}`) : ['- אין']),
    '',
    'משימות פתוחות:',
    ...(ctx.openTasks.length > 0
      ? ctx.openTasks.map((t) => `- ${t.title}${t.due ? ` (עד ${t.due})` : ''}`)
      : ['- אין']),
    '',
    'פעילות אחרונה:',
    ...(ctx.recentActivity.length > 0 ? ctx.recentActivity.map((a) => `- ${a}`) : ['- אין']),
  ].join('\n');
}
