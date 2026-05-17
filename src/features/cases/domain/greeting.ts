/** Time-of-day greeting for the dashboard welcome banner. */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 18) return 'צהריים טובים';
  if (hour < 22) return 'ערב טוב';
  return 'לילה טוב';
}

/** Dynamic insight string based on case counts. */
export function getInsight(totalCases: number, stuckCount: number): string {
  if (totalCases === 0) return 'מתחילים נקי - צור את התיק הראשון שלך';
  if (stuckCount > 0) {
    const noun = stuckCount === 1 ? 'תיק תקוע אחד' : `${stuckCount} תיקים תקועים`;
    const verb = stuckCount === 1 ? 'דורש' : 'דורשים';
    return `יש ${noun} ש${verb} תשומת לב`;
  }
  if (totalCases === 1) return 'תיק אחד פעיל במערכת';
  return `${totalCases} תיקים פעילים במערכת - הכל זורם`;
}
