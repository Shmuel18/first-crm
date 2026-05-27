import { z } from 'zod';

import {
  CURRENCY_MAX_ILS,
  optionalCurrency,
  optionalDate,
  optionalNotes,
} from '@/lib/validators/form-primitives';

/**
 * Shape of the expenses inline-edit cells on the admin block. Each cell
 * is optional — a fresh empty row is created by the "+ הוצאה" button and
 * the user fills the fields one at a time via blur-save.
 *
 * Description uses optionalNotes (2,000 char cap) — typical entries are
 * one-liners but we leave headroom for the occasional paragraph.
 */
export const ExpenseFormShape = z.object({
  expense_date: optionalDate,
  amount: optionalCurrency(CURRENCY_MAX_ILS),
  description: optionalNotes(),
});

export type ExpenseFormInput = z.infer<typeof ExpenseFormShape>;
