/**
 * The loan a percentage fee is taken of: the primary property's requested loan
 * plus every additional property's (case_properties). Mirrors the database's
 * case_total_requested_loan() (migration 250), which derives fee_amount — this
 * copy only feeds the "of a mortgage of …" hint next to the fee field.
 * Null when no property carries a loan figure.
 */
export function totalRequestedLoan(
  primary: number | null,
  additional: ReadonlyArray<{ requested_mortgage_amount: number | null }>,
): number | null {
  const amounts = [primary, ...additional.map((p) => p.requested_mortgage_amount)].filter(
    (v): v is number => v !== null,
  );
  return amounts.length === 0 ? null : amounts.reduce((sum, v) => sum + v, 0);
}
