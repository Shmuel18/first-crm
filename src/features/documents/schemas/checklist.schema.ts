import { z } from 'zod';

/** Free-text label for a manually-added checklist row. */
export const ChecklistLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

/** Ordered list of item ids for a drag-reorder. */
export const ChecklistOrderSchema = z.array(z.string().uuid()).min(1);
