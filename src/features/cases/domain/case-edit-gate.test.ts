import { describe, expect, it } from 'vitest';

import { canEditCaseRow, type CaseEditGate } from './case-edit-gate';

const MANAGER: CaseEditGate = {
  canChangeStatus: true,
  canAssignAdvisor: true,
  editAny: true,
  editOwn: true,
  userId: 'mgr',
};

// Advisor: can edit only cases they own or are associated with.
const ADVISOR: CaseEditGate = {
  canChangeStatus: true,
  canAssignAdvisor: false,
  editAny: false,
  editOwn: true,
  userId: 'adv-1',
};

// Secretary / view-only: sees all cases (view_all_cases) but has NO edit perms.
const VIEW_ONLY: CaseEditGate = {
  canChangeStatus: false,
  canAssignAdvisor: false,
  editAny: false,
  editOwn: false,
  userId: 'sec-1',
};

const ownRow = { advisorId: 'adv-1', associatedAdvisorIds: [] as string[] };
const othersRow = { advisorId: 'adv-2', associatedAdvisorIds: [] as string[] };
const associatedRow = { advisorId: 'adv-2', associatedAdvisorIds: ['adv-1'] };

describe('canEditCaseRow — dashboard inline-edit authority (R6-inline-actions-1)', () => {
  it('manager (edit_any_case) can edit any row, even one not assigned to them', () => {
    expect(canEditCaseRow(MANAGER, othersRow)).toBe(true);
    expect(canEditCaseRow(MANAGER, ownRow)).toBe(true);
  });

  it('advisor can edit their OWN case', () => {
    expect(canEditCaseRow(ADVISOR, ownRow)).toBe(true);
  });

  it('advisor can edit a case they are an ASSOCIATED advisor on', () => {
    expect(canEditCaseRow(ADVISOR, associatedRow)).toBe(true);
  });

  it("advisor CANNOT edit another advisor's case", () => {
    expect(canEditCaseRow(ADVISOR, othersRow)).toBe(false);
  });

  it('VIEW-ONLY user (e.g. a secretary with view_all_cases, no edit perms) cannot edit ANY row', () => {
    expect(canEditCaseRow(VIEW_ONLY, ownRow)).toBe(false);
    expect(canEditCaseRow(VIEW_ONLY, othersRow)).toBe(false);
    expect(canEditCaseRow(VIEW_ONLY, associatedRow)).toBe(false);
  });

  it('edit_own_case with no resolved user id is a hard deny (cannot match assigned/associated)', () => {
    expect(canEditCaseRow({ ...ADVISOR, userId: null }, ownRow)).toBe(false);
  });

  it('granular status/advisor gates compose ON TOP of row authority', () => {
    // The components AND these flags with canEditCaseRow. A secretary fails the
    // row gate, so status/advisor are never interactive regardless of the
    // granular flags; an advisor on their own case gets status (has the perm)
    // but not advisor-reassign (lacks assign_case_to_user).
    const advisorCanEditOwn = canEditCaseRow(ADVISOR, ownRow);
    expect(advisorCanEditOwn && ADVISOR.canChangeStatus).toBe(true);
    expect(advisorCanEditOwn && ADVISOR.canAssignAdvisor).toBe(false);
    expect(canEditCaseRow(VIEW_ONLY, ownRow) && VIEW_ONLY.canChangeStatus).toBe(false);
  });
});
