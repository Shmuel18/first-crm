/**
 * Deterministic digest fact block — pure and tested. The DB computes every
 * number and list; the AI only REPHRASES this block (and when the AI is
 * unavailable, this block IS the digest — the feature degrades gracefully,
 * never silently skips a scheduled delivery).
 */

export type DigestFacts = {
  /** Israel calendar date the digest covers (YYYY-MM-DD). */
  date: string;
  /** Open tasks assigned to the user whose due date has passed. */
  overdueTasks: string[];
  /** Open tasks assigned to the user due today. */
  todayTasks: string[];
  /** Count of remaining open tasks (beyond overdue/today). */
  otherOpenTasks: number;
  /** The user's active cases past their target date ("#num · client"). */
  overdueTargetCases: string[];
  /** Count of the user's active cases. */
  activeCases: number;
};

export function hasUrgentItems(f: DigestFacts): boolean {
  return f.overdueTasks.length > 0 || f.todayTasks.length > 0 || f.overdueTargetCases.length > 0;
}

/** The plain-Hebrew fact block — both the AI's grounding and the fallback text. */
export function formatDigestFacts(f: DigestFacts): string {
  const lines: string[] = [];

  if (f.overdueTasks.length > 0) {
    lines.push(`משימות באיחור (${f.overdueTasks.length}):`);
    lines.push(...f.overdueTasks.map((t) => `- ${t}`));
  }
  if (f.todayTasks.length > 0) {
    lines.push(`משימות להיום (${f.todayTasks.length}):`);
    lines.push(...f.todayTasks.map((t) => `- ${t}`));
  }
  if (f.otherOpenTasks > 0) {
    lines.push(`ועוד ${f.otherOpenTasks} משימות פתוחות.`);
  }
  if (f.overdueTargetCases.length > 0) {
    lines.push(`תיקים שעברו את תאריך היעד (${f.overdueTargetCases.length}):`);
    lines.push(...f.overdueTargetCases.map((c) => `- ${c}`));
  }
  if (lines.length === 0) {
    return `אין פריטים דחופים להיום. ${f.activeCases} תיקים פעילים באחריותך.`;
  }
  lines.push(`סה"כ ${f.activeCases} תיקים פעילים באחריותך.`);
  return lines.join('\n');
}
