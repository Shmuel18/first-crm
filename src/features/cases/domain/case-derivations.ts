/**
 * Pure derivations from a CaseWithRelations shape.
 *
 * These are display-layer selectors (no DB/network) so they belong in the
 * domain layer per CLAUDE.md - not in services/. Previously co-located with
 * the listCases/getCaseById service functions because they shared the same
 * join type, but UI components should not have to reach into services for
 * pure logic.
 */

import { formatPersonName } from '@/lib/utils/person-name';

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

/** Up to this many borrower names are shown in full; beyond it the rest
 *  collapse to a "+N" suffix so the header label can't run away. */
const MAX_NAMES_SHOWN = 2;
const NAME_SEPARATOR = ' · ';

/**
 * Client label for a case header. Primary borrower first, then:
 *   - 1 borrower  → "ישראלי ישראל"
 *   - 2 borrowers → "ישראלי ישראל · כהן דנה"  (both names — an advisor wants
 *     to see who the co-borrower is, not a faceless "+1")
 *   - 3+          → first two names + " +N" for the remainder.
 */
export function getCaseClientLabel(caseItem: {
  case_borrowers?: ReadonlyArray<CaseBorrowerJoin> | null;
}): string {
  const borrowers = (caseItem.case_borrowers ?? [])
    .filter((cb) => cb.borrower !== null)
    .map((cb) => ({
      isPrimary: cb.is_primary,
      name: formatPersonName(cb.borrower!.first_name, cb.borrower!.last_name),
    }))
    .filter((b) => b.name);

  if (borrowers.length === 0) return '';

  borrowers.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const names = borrowers.map((b) => b.name);

  const shown = names.slice(0, MAX_NAMES_SHOWN).join(NAME_SEPARATOR);
  const extra = names.length - MAX_NAMES_SHOWN;
  return extra > 0 ? `${shown} +${extra}` : shown;
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
