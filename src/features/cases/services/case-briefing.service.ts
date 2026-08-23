import 'server-only';

import { listCaseActivity } from '@/features/case-activity/services/case-activity.service';
import { getCaseDocumentChecklist } from '@/features/documents/services/document-checklist.service';
import { listDocumentsForCase } from '@/features/documents/services/documents.service';
import { getCaseFinancials } from '@/features/cases/services/case-lookups.service';
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
    // Financial safety: describeEvent below formats only non-financial event
    // kinds (field-level diffs are dropped entirely), so fee data never
    // reaches the AI context regardless of the caller's permissions.
    listCaseActivity(branded),
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
      .filter((item) => item.status === 'missing')
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

/**
 * Rich, RLS-safe fact sheet for free-text case Q&A (ai-v2-spec.md §5 — case
 * questions). Everything the advisor might ask about ONE case: status, target
 * date, each borrower's role + contact + children + birth date, banks, missing
 * docs, open tasks, recent activity. Runs under the CALLER's client, so a case
 * they can't see returns null. Financial figures (fees, expected income) are
 * deliberately EXCLUDED — the assistant answers operational facts, not money.
 * Returns a Hebrew text block the model answers FROM (never invents).
 */
export async function assembleCaseFactSheet(caseId: string): Promise<{ label: string; sheet: string } | null> {
  const supabase = await createClient();
  const branded = asCaseId(caseId);

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, case_number, target_date, insurance_agent_name, referrer_name, status:case_statuses(name_he)')
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!caseRow) return null;

  const [{ data: caseBorrowers }, { data: caseBanks }, documents, tasks, activity, financials] =
    await Promise.all([
      supabase
        .from('case_borrowers')
        .select(
          'is_primary, role_in_case, borrower:borrowers(first_name, last_name, email, phone, landline_phone, children_count, birth_date, address, national_id)',
        )
        .eq('case_id', caseId),
      supabase
        .from('case_banks')
        .select('is_primary, bank:banks(name_he)')
        .eq('case_id', caseId)
        .is('deleted_at', null),
      listDocumentsForCase(branded),
      listTasksForCase(branded),
      listCaseActivity(branded),
      // Fees: getCaseFinancials returns null unless the caller has view_case_fee
      // AND can see this case (case_financials RLS, mig 200). So including it
      // here is automatically permission-gated — a non-manager's fact sheet
      // simply has no fee line (user's "open financials, each per permission").
      getCaseFinancials(branded),
    ]);

  const checklist = await getCaseDocumentChecklist(branded, documents);
  const status = caseRow.status as unknown as { name_he: string } | null;
  const label = String(caseRow.case_number ?? caseId);

  const borrowerLines = (caseBorrowers ?? []).map((row) => {
    const b = row.borrower as unknown as {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      landline_phone: string | null;
      children_count: number | null;
      birth_date: string | null;
      address: string | null;
      national_id: string | null;
    } | null;
    if (!b) return '';
    const name = [b.first_name, b.last_name].filter(Boolean).join(' ') || '(ללא שם)';
    const parts = [
      `${row.is_primary ? 'לווה ראשי' : 'לווה'}${row.role_in_case ? ` (${row.role_in_case})` : ''}: ${name}`,
    ];
    if (b.email) parts.push(`אימייל ${b.email}`);
    if (b.phone) parts.push(`טלפון ${b.phone}`);
    if (b.landline_phone) parts.push(`טלפון קווי ${b.landline_phone}`);
    if (b.children_count !== null) parts.push(`ילדים: ${b.children_count}`);
    if (b.birth_date) parts.push(`תאריך לידה ${b.birth_date}`);
    if (b.address) parts.push(`כתובת ${b.address}`);
    if (b.national_id) parts.push(`ת"ז ${b.national_id}`);
    return `- ${parts.join(' · ')}`;
  }).filter(Boolean);

  const bankLines = (caseBanks ?? [])
    .map((row) => (row.bank as unknown as { name_he: string } | null)?.name_he)
    .filter((n): n is string => Boolean(n));

  const missingDocs = checklist.filter((i) => i.status === 'missing').map((i) => i.nameHe);

  const sheet = [
    `תיק מספר ${label}`,
    `סטטוס: ${status?.name_he ?? 'לא ידוע'}`,
    `תאריך יעד: ${caseRow.target_date ?? 'לא נקבע'}`,
    caseRow.insurance_agent_name ? `סוכן ביטוח: ${caseRow.insurance_agent_name}` : '',
    caseRow.referrer_name ? `מפנה: ${caseRow.referrer_name}` : '',
    '',
    'לווים:',
    ...(borrowerLines.length > 0 ? borrowerLines : ['- אין']),
    '',
    `בנקים: ${bankLines.length > 0 ? bankLines.join(', ') : 'אין'}`,
    // Fee line only when permission-gated getCaseFinancials returned a value.
    financials && financials.fee_amount !== null
      ? `שכר טרחה שסוכם: ${financials.fee_amount} ₪`
      : '',
    '',
    'מסמכים חסרים:',
    ...(missingDocs.length > 0 ? missingDocs.map((d) => `- ${d}`) : ['- אין']),
    '',
    'משימות פתוחות:',
    ...(tasks.length > 0 ? tasks.slice(0, 10).map((t) => `- ${t.title}${t.due_date ? ` (עד ${t.due_date})` : ''}`) : ['- אין']),
    '',
    'פעילות אחרונה:',
    ...(activity.events.slice(0, 8).map(describeEvent).filter((s) => s.length > 0)),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

  return { label, sheet };
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
