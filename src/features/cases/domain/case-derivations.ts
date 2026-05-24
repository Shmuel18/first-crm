/**
 * Pure derivations from a CaseWithRelations shape.
 *
 * These are display-layer selectors (no DB/network) so they belong in the
 * domain layer per CLAUDE.md - not in services/. Previously co-located with
 * the listCases/getCaseById service functions because they shared the same
 * join type, but UI components should not have to reach into services for
 * pure logic.
 */

type CaseBorrowerJoin = {
  is_primary: boolean;
  borrower: {
    first_name: string | null;
    last_name: string | null;
    national_id?: string | null;
  } | null;
};

type CaseBankJoin = {
  is_primary: boolean;
  deleted_at: string | null;
  bank: {
    id: string;
    name_he: string;
    name_en: string;
    color: string;
    logo_url: string | null;
    key: string;
  } | null;
};

/**
 * Returns "ישראל ישראלי" or "ישראל ישראלי +1" based on the borrowers
 * in the case (primary first, additional surfaced as +N).
 */
export function getCaseClientLabel(caseItem: {
  case_borrowers?: ReadonlyArray<CaseBorrowerJoin> | null;
}): string {
  const borrowers = (caseItem.case_borrowers ?? [])
    .filter((cb) => cb.borrower !== null)
    .map((cb) => ({
      isPrimary: cb.is_primary,
      name:
        [cb.borrower!.first_name, cb.borrower!.last_name].filter(Boolean).join(' ').trim(),
    }))
    .filter((b) => b.name);

  if (borrowers.length === 0) return '';

  borrowers.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const primaryName = borrowers[0]!.name;
  const extra = borrowers.length - 1;

  return extra > 0 ? `${primaryName} +${extra}` : primaryName;
}

/** Israeli national ID of the primary borrower. */
export function getPrimaryBorrowerNationalId(caseItem: {
  case_borrowers?: ReadonlyArray<CaseBorrowerJoin> | null;
}): string | null {
  const borrowers = (caseItem.case_borrowers ?? []).filter((cb) => cb.borrower !== null);
  if (borrowers.length === 0) return null;
  const primary = borrowers.find((cb) => cb.is_primary) ?? borrowers[0];
  return primary?.borrower?.national_id ?? null;
}

/**
 * Sort key for the primary borrower — "last_name first_name" so an A-B sort
 * orders by surname first (as a phone book does) and uses the first name only
 * to break ties between people who share a surname.
 */
export function getPrimaryBorrowerSortKey(caseItem: {
  case_borrowers?: ReadonlyArray<CaseBorrowerJoin> | null;
}): string {
  const borrowers = (caseItem.case_borrowers ?? []).filter((cb) => cb.borrower !== null);
  if (borrowers.length === 0) return '';
  const primary = borrowers.find((cb) => cb.is_primary) ?? borrowers[0];
  if (!primary?.borrower) return '';
  const last = primary.borrower.last_name?.trim() ?? '';
  const first = primary.borrower.first_name?.trim() ?? '';
  return [last, first].filter(Boolean).join(' ');
}

/** Primary bank metadata (excludes soft-deleted bank links). */
export function getPrimaryBank(caseItem: {
  case_banks?: ReadonlyArray<CaseBankJoin> | null;
}): {
  id: string;
  name_he: string;
  name_en: string;
  color: string;
  logo_url: string | null;
  key: string;
} | null {
  const banks = (caseItem.case_banks ?? [])
    .filter((cb) => cb.bank !== null && !cb.deleted_at);
  if (banks.length === 0) return null;
  const primary = banks.find((cb) => cb.is_primary) ?? banks[0];
  return primary?.bank ?? null;
}

/** Secondary banks count for the "+N" indicator. */
export function getSecondaryBanksCount(caseItem: {
  case_banks?: ReadonlyArray<CaseBankJoin> | null;
}): number {
  const banks = (caseItem.case_banks ?? [])
    .filter((cb) => cb.bank !== null && !cb.deleted_at);
  if (banks.length <= 1) return 0;
  return banks.length - 1;
}
