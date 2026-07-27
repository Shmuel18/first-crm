/**
 * "Which client is this about?" — the context every case-linked notification
 * carries (bell row, email body, email subject). Snapshotted into the
 * notification payload at creation time (migration 222) so it stays correct
 * even after the case is renamed or the primary borrower changes.
 */
export type CaseLabel = {
  caseNumber: string;
  clientName: string | null;
  /** "#1042 · יעקב כהן" — the context line under a bell row / in an email body. */
  label: string;
  /** Shortest identifier for a subject line: the client's name, else "#1042". */
  short: string;
};

export function buildCaseLabel(caseNumber: string, clientName: string | null): CaseLabel {
  const name = clientName?.trim() || null;
  return {
    caseNumber,
    clientName: name,
    label: `#${caseNumber}${name ? ` · ${name}` : ''}`,
    short: name ?? `#${caseNumber}`,
  };
}

/**
 * Appends the client to an email subject so the inbox list alone answers
 * "which client?". No-ops when there's no case (office task) or when the
 * template's subject already names it (e.g. the SLA overdue subject).
 */
export function withCaseInSubject(subject: string, short: string | null | undefined): string {
  if (!short || subject.includes(short)) return subject;
  return `${subject} — ${short}`;
}
