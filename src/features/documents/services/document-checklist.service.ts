import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { DocumentWithRelations, DriveFolder } from '../types';

/**
 * One entry in the per-case document checklist. As of migration 099 the
 * checklist is MATERIALIZED in case_checklist_items (seeded from the
 * case_type_documents template on first access) so it can be ticked, added
 * to, removed from and reordered per case.
 *
 * `status` is derived for the at-a-glance folder view. Kaufman has no manual
 * review queue: a checklist row is complete as soon as any document is filed
 * in its category (or the row is ticked manually), otherwise it is missing.
 */
export type ChecklistStatus = 'missing' | 'verified';

export type DocumentChecklistItem = {
  itemId: string;
  categoryId: string | null;
  categoryKey: string;
  nameHe: string;
  nameEn: string;
  driveFolder: DriveFolder | null;
  isRequired: boolean;
  /** Free-text manual row (no linked document category). */
  isManual: boolean;
  /** The manual "received" tick from case_checklist_items. */
  isDone: boolean;
  requiredAtStage: { id: string; key: string; name_he: string; name_en: string } | null;
  status: ChecklistStatus;
  uploadedCount: number;
  /** Documents filed against this requirement. Presence means accepted. */
  validDocumentCount: number;
};

const StageSchema = z.object({
  id: z.string(),
  key: z.string(),
  name_he: z.string(),
  name_en: z.string(),
});

const RpcItemSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  categoryKey: z.string().nullable(),
  nameHe: z.string().nullable(),
  nameEn: z.string().nullable(),
  label: z.string().nullable(),
  driveFolder: z.string().nullable(),
  isRequired: z.boolean(),
  isDone: z.boolean(),
  source: z.enum(['template', 'manual']),
  sortOrder: z.number(),
  requiredAtStage: StageSchema.nullable(),
});

const RpcResultSchema = z.array(RpcItemSchema);

/**
 * Load (and lazily materialize) the per-case checklist, then fold in the
 * already-loaded documents to compute each row's display status. Returns []
 * on any failure so the page renders identically to the no-checklist case.
 */
export async function getCaseDocumentChecklist(
  caseId: CaseId,
  documents: ReadonlyArray<DocumentWithRelations>,
): Promise<DocumentChecklistItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_or_create_case_checklist', {
    p_case_id: caseId,
  });

  if (error) {
    console.error('[checklist] get_or_create rpc failed', { code: error.code ?? null });
    return [];
  }

  const parsed = RpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[checklist] unexpected rpc shape');
    return [];
  }

  // Map category_id → filed documents. There is deliberately no second
  // verification pass: presence is completion for Kaufman's workflow.
  const byCategory = new Map<string, DocumentWithRelations[]>();
  for (const d of documents) {
    if (!d.category?.id) continue;
    const list = byCategory.get(d.category.id) ?? [];
    list.push(d);
    byCategory.set(d.category.id, list);
  }

  return parsed.data.map((r): DocumentChecklistItem => {
    const uploads = r.categoryId ? (byCategory.get(r.categoryId) ?? []) : [];
    const validDocumentCount = uploads.length;
    const status: ChecklistStatus = r.isDone || validDocumentCount > 0 ? 'verified' : 'missing';

    const fallback = r.label ?? '';
    return {
      itemId: r.id,
      categoryId: r.categoryId,
      categoryKey: r.categoryKey ?? '',
      nameHe: r.nameHe ?? fallback,
      nameEn: r.nameEn ?? fallback,
      driveFolder: (r.driveFolder as DriveFolder | null) ?? null,
      isRequired: r.isRequired,
      isManual: r.source === 'manual',
      isDone: r.isDone,
      requiredAtStage: r.requiredAtStage,
      status,
      uploadedCount: uploads.length,
      validDocumentCount,
    };
  });
}
