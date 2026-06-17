'use server';

import {
  listActiveChecklistTemplates,
  type ChecklistTemplateOption,
} from '../services/checklist-templates-store.service';

/**
 * Active preset checklist templates for the client-side picker (the "רשימה
 * מוכנה" dropdown). Fetched on mount so the lists are DB-driven (editable from
 * /settings/checklists) rather than baked into the bundle.
 */
export async function getActiveChecklistTemplatesAction(): Promise<{
  ok: true;
  templates: ChecklistTemplateOption[];
}> {
  return { ok: true, templates: await listActiveChecklistTemplates() };
}
