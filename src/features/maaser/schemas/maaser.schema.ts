import { z } from 'zod';

/** Single source of truth for the add-donation form (client) + action (server). */
export const AddMaaserPaymentSchema = z.object({
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date'),
  amount: z.number().positive().max(100_000_000),
  recipient: z.string().trim().max(200).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export type AddMaaserPaymentInput = z.infer<typeof AddMaaserPaymentSchema>;
