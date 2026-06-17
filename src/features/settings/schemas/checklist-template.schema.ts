import { z } from 'zod';

export const CHECKLIST_TEMPLATE_GROUP_VALUES = ['identity', 'income', 'process'] as const;

export type ChecklistTemplateGroupValue = (typeof CHECKLIST_TEMPLATE_GROUP_VALUES)[number];

/**
 * Admin-editable preset checklist template (the "רשימה מוכנה" lists). Items are
 * a list of free-text labels — the manager edits them one per line, the client
 * splits to an array before sending.
 */
export const ChecklistTemplateFormSchema = z.object({
  id: z.uuid().optional(),
  name_he: z.string().trim().min(1, { error: 'common.errors.required' }).max(120),
  name_en: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(120)),
  group_key: z.enum(CHECKLIST_TEMPLATE_GROUP_VALUES, { error: 'common.errors.invalidEnum' }),
  items: z
    .array(z.string().trim().min(1).max(500))
    .max(50, { error: 'common.errors.tooLarge' })
    .default([]),
  is_active: z.boolean().default(true),
});

export type ChecklistTemplateFormInput = z.infer<typeof ChecklistTemplateFormSchema>;
