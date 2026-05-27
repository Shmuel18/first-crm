import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { DocumentWithRelations, DriveFolder } from '../types';

/**
 * One entry in the per-case document-requirements checklist. Surfaces the
 * "which docs does this case still need" question on top of the live
 * documents page, computed by joining:
 *
 *   - cases.case_type_primary_id      (which requirements apply)
 *   - case_type_documents             (the requirements config, admin-editable)
 *   - document_categories             (display name + folder)
 *   - case_statuses                   (the stage by which a doc is needed)
 *   - documents                       (what's already uploaded for the case)
 *
 * `status` is derived:
 *   - 'missing'  — no uploaded doc with this category
 *   - 'pending'  — uploaded, none verified yet
 *   - 'rejected' — every uploaded doc was rejected (verifier flagged)
 *   - 'verified' — at least one uploaded doc is verified
 *
 * Sorted by case_type_documents.sort_order (admin curates), then category.
 */
export type ChecklistStatus = 'missing' | 'pending' | 'verified' | 'rejected';

export type DocumentChecklistItem = {
  categoryId: string;
  categoryKey: string;
  nameHe: string;
  nameEn: string;
  driveFolder: DriveFolder | null;
  isRequired: boolean;
  requiredAtStage: { id: string; key: string; name_he: string; name_en: string } | null;
  status: ChecklistStatus;
  uploadedCount: number;
  verifiedCount: number;
};

type CaseTypeDocRow = {
  is_required: boolean;
  sort_order: number;
  category: {
    id: string;
    key: string;
    name_he: string;
    name_en: string;
    drive_folder: string | null;
    sort_order: number;
    is_active: boolean;
  } | null;
  required_at_stage: {
    id: string;
    key: string;
    name_he: string;
    name_en: string;
  } | null;
};

/**
 * Fetch the checklist for a case. Returns [] when the case has no primary
 * type set (brand-new draft cases) or the type has no seeded requirements.
 * The caller passes the already-loaded documents list so we don't re-query.
 */
export async function getCaseDocumentChecklist(
  caseId: CaseId,
  caseTypePrimaryId: string | null,
  documents: ReadonlyArray<DocumentWithRelations>,
): Promise<DocumentChecklistItem[]> {
  void caseId; // reserved for a future "this case overrides the global config" path
  if (!caseTypePrimaryId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_type_documents')
    .select(
      `
      is_required,
      sort_order,
      category:document_categories!case_type_documents_document_category_id_fkey(
        id, key, name_he, name_en, drive_folder, sort_order, is_active
      ),
      required_at_stage:case_statuses!case_type_documents_required_at_stage_id_fkey(
        id, key, name_he, name_en
      )
    `,
    )
    .eq('case_type_id', caseTypePrimaryId);

  if (error) {
    console.error('[checklist] case_type_documents fetch failed', {
      caseTypePrimaryId,
      code: error.code ?? null,
      message: error.message ?? null,
    });
    return [];
  }

  const rows = (data ?? []) as unknown as CaseTypeDocRow[];

  // Map: category_id → bucket of uploaded docs for the computed status.
  const byCategory = new Map<string, DocumentWithRelations[]>();
  for (const d of documents) {
    if (!d.category?.id) continue;
    const list = byCategory.get(d.category.id) ?? [];
    list.push(d);
    byCategory.set(d.category.id, list);
  }

  const items: DocumentChecklistItem[] = rows
    .filter((r) => r.category && r.category.is_active)
    .map((r): DocumentChecklistItem => {
      const cat = r.category!;
      const uploads = byCategory.get(cat.id) ?? [];
      const verifiedCount = uploads.filter((d) => d.status === 'verified').length;
      const rejectedCount = uploads.filter((d) => d.status === 'rejected').length;
      let status: ChecklistStatus;
      if (uploads.length === 0) status = 'missing';
      else if (verifiedCount > 0) status = 'verified';
      else if (rejectedCount === uploads.length) status = 'rejected';
      else status = 'pending';

      return {
        categoryId: cat.id,
        categoryKey: cat.key,
        nameHe: cat.name_he,
        nameEn: cat.name_en,
        driveFolder: (cat.drive_folder as DriveFolder | null) ?? null,
        isRequired: r.is_required,
        requiredAtStage: r.required_at_stage,
        status,
        uploadedCount: uploads.length,
        verifiedCount,
      };
    });

  // Stable order: required first, then by admin-curated sort_order, then category.
  items.sort((a, b) => {
    if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
    return a.nameHe.localeCompare(b.nameHe, 'he');
  });

  return items;
}
