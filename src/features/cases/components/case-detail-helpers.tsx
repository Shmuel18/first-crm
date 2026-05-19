import Link from 'next/link';

import type { ltvBand } from '../domain/calculations';

/** Color band for the LTV row in the property block. */
export function bandToAccent(band: ReturnType<typeof ltvBand>): 'green' | 'yellow' | 'red' {
  if (band === 'high') return 'red';
  if (band === 'moderate') return 'yellow';
  return 'green';
}

/** Empty-state block shown inside the Borrowers card when no borrowers yet. */
export function EmptyBorrowers({
  caseId,
  emptyText,
  ctaText,
}: {
  caseId: string;
  emptyText: string;
  ctaText: string;
}) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-neutral-500 mb-3">{emptyText}</p>
      <Link
        href={`/cases/${caseId}/borrowers/new`}
        className="btn-gold inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
      >
        {ctaText}
      </Link>
    </div>
  );
}
