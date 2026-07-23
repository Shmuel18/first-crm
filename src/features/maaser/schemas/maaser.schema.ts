import { z } from 'zod';

/** Single source of truth for the add-donation form (client) + action (server). */
export const AddMaaserPaymentSchema = z.object({
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date'),
  amount: z.number().positive().max(100_000_000),
  recipient: z.string().trim().max(200).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export type AddMaaserPaymentInput = z.infer<typeof AddMaaserPaymentSchema>;

/** Single source of truth for the manual income/expense form (client) + action (server). */
export const AddMaaserEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date'),
  kind: z.enum(['income', 'expense']),
  amount: z.number().positive().max(100_000_000),
  description: z.string().trim().max(500).nullish(),
});

export type AddMaaserEntryInput = z.infer<typeof AddMaaserEntrySchema>;
