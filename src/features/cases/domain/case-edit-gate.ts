/**
 * Dashboard inline-edit authority.
 *
 * The case-detail page calls the can_edit_case RPC (migration 147) for the
 * single open case. The dashboard renders ~80 rows, so a per-row RPC would be
 * wasteful — instead we mirror can_edit_case's logic in this pure helper from
 * data the row already carries (responsible + associated advisor ids) plus the
 * viewer's permission flags. The DB still enforces every write; this only keeps
 * the dashboard's inline controls honest.
 *
 * IMPORTANT: do NOT use `view_all_cases` (canViewAll) as an edit gate — it is a
 * VISIBILITY scope, not an edit permission. A user can see a case (e.g. a
 * secretary with view_all_cases) without any authority to edit it.
 */

export type CaseEditGate = {
  /** has the change_case_status permission */
  canChangeStatus: boolean;
  /** has the assign_case_to_user permission */
  canAssignAdvisor: boolean;
  /** has the edit_any_case permission (manager) */
  editAny: boolean;
  /** has the edit_own_case permission (advisor) */
  editOwn: boolean;
  /** the viewer's own user id, for the own-case check */
  userId: string | null;
};

type RowAdvisors = {
  advisorId: string | null;
  associatedAdvisorIds: ReadonlyArray<string>;
};

/**
 * Whether the viewer may edit this specific row, mirroring can_edit_case:
 * edit_any_case, OR edit_own_case AND the viewer is the responsible advisor OR
 * an associated advisor on the row. (Dashboard rows are always non-deleted.)
 */
export function canEditCaseRow(gate: CaseEditGate, row: RowAdvisors): boolean {
  if (gate.editAny) return true;
  if (!gate.editOwn || !gate.userId) return false;
  return row.advisorId === gate.userId || row.associatedAdvisorIds.includes(gate.userId);
}
