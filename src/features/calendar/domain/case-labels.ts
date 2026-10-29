/**
 * How a case is named on the calendar: the client's name only — the office
 * reads clients, not case numbers. A case with no borrower yet falls back to
 * its number so it never renders blank.
 */
export function calendarCaseLabel(clientName: string, caseNumber: string): string {
  return clientName || `#${caseNumber}`;
}

/**
 * Labels for the event form's case picker: the client's name, with the case
 * number appended only where two open cases share that name.
 */
export function caseChoiceLabels(
  cases: ReadonlyArray<{ id: string; clientName: string; caseNumber: string }>,
): Array<{ id: string; label: string }> {
  const counts = new Map<string, number>();
  for (const c of cases) counts.set(c.clientName, (counts.get(c.clientName) ?? 0) + 1);
  return cases.map((c) => ({
    id: c.id,
    label:
      c.clientName && (counts.get(c.clientName) ?? 0) > 1
        ? `${c.clientName} · #${c.caseNumber}`
        : calendarCaseLabel(c.clientName, c.caseNumber),
  }));
}
