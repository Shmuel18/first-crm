/** How a case reads on the calendar: the client's name; the number only when there is no name. */
export function calendarCaseLabel(caseNumber: string, clientName: string): string {
  return clientName.trim() || `#${caseNumber}`;
}

type CaseChoiceSource = { id: string; caseNumber: string; clientName: string };

/**
 * Case-picker options: just the client's name, plus "· #number" on the
 * names more than one open case shares, so the choice stays unambiguous.
 */
export function caseChoiceLabels(
  cases: ReadonlyArray<CaseChoiceSource>,
): Array<{ id: string; label: string }> {
  const counts = new Map<string, number>();
  for (const c of cases) {
    const label = calendarCaseLabel(c.caseNumber, c.clientName);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return cases.map((c) => {
    const label = calendarCaseLabel(c.caseNumber, c.clientName);
    return { id: c.id, label: (counts.get(label) ?? 0) > 1 ? `${label} · #${c.caseNumber}` : label };
  });
}
