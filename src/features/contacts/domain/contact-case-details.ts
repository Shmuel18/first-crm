import { getCaseClientLabelFull, getPrimaryBank, getPrimaryBorrowerNationalId } from '@/features/cases/domain/case-derivations';
import type { CaseWithRelations } from '@/features/cases/types';
import { formatCurrency } from '@/lib/utils/format-currency';

import type { ContactCaseDetails } from './contact-message';

/** The case's details, formatted for a message to a professional. */
export function contactCaseDetails(c: CaseWithRelations, totalLoan: number | null): ContactCaseDetails {
  const primary = c.case_borrowers?.find((cb) => cb.is_primary)?.borrower ?? null;
  const bank = getPrimaryBank(c);
  return {
    clientName: getCaseClientLabelFull(c) || null,
    nationalId: getPrimaryBorrowerNationalId(c),
    phone: primary?.phone ?? null,
    city: c.city ?? null,
    gushHelka: c.gush_helka ?? null,
    propertyValue: c.property_value == null ? null : formatCurrency(c.property_value, 'he'),
    loanAmount: totalLoan == null ? null : formatCurrency(totalLoan, 'he'),
    bank: bank?.name_he ?? null,
  };
}
