import { z } from 'zod';

import {
  CURRENCY_MAX_ILS,
  NAME_MAX,
  optionalCurrency,
  optionalShortString,
} from '@/lib/validators/form-primitives';

/**
 * Shape of the manager-only commissions/salaries inline cells. Each row is a
 * recipient (who's paid — "advisor" / "referrer") + an amount, both optional
 * so a fresh blank row is created and filled one cell at a time via blur-save.
 */
export const PayoutFormShape = z.object({
  recipient: optionalShortString(NAME_MAX),
  amount: optionalCurrency(CURRENCY_MAX_ILS),
});

export type PayoutFormInput = z.infer<typeof PayoutFormShape>;
