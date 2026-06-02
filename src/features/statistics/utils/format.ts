// Case money columns (requested_mortgage_amount, fee_amount, expected_income)
// are NUMERIC shekels — NOT agorot like the simulator money type. Format them
// directly without the /100 conversion.
const nisFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

const intFormatter = new Intl.NumberFormat('he-IL');

export function formatNis(shekels: number): string {
  return nisFormatter.format(shekels);
}

export function formatInt(value: number): string {
  return intFormatter.format(value);
}
