import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { listIncomesForCase } from '@/features/incomes/services/incomes.service';
import { listObligationsForCase } from '@/features/obligations/services/obligations.service';
import type { CaseId } from '@/lib/types/branded';

import { calculateLtv } from '../domain/calculations';
import {
  calculateAvailableIncome,
  calculateDtiBands,
  calculateDtiPercent,
  isLongTermObligation,
} from '../domain/dti';
import { getCaseById } from '../services/cases.service';

/**
 * Strongly-typed shape passed into <BankPdfDocument />. Whatever the PDF needs,
 * the loader assembles in one place — so the document is a pure function of
 * data, and the data layer doesn't depend on react-pdf.
 *
 * DTI / available-income math lives in `../domain/dti` (testable in
 * isolation). This file is just a SQL→DTO mapper.
 */

export type BankPdfData = {
  case: {
    caseNumber: string;
    createdAt: string;
    statusName: string | null;
    propertyValue: number | null;
    requestedAmount: number | null;
    equity: number | null;
    ltv: number | null;
  };
  advisorName: string | null;
  advisorPhone: string | null;
  advisorEmail: string | null;
  borrowers: Array<{
    id: string;
    fullName: string;
    role: 'borrower' | 'guarantor';
    isPrimary: boolean;
    nationalId: string | null;
    idIssueDate: string | null;
    idExpiryDate: string | null;
    birthDate: string | null;
    /** Computed integer years at PDF generation time. Stored here (not in
     *  the component) because React purity rules forbid Date.now() during
     *  render. */
    ageYears: number | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    citizenship: string | null;
    residencyType: string | null;
    maritalStatus: string | null;
    childrenCount: number | null;
    gender: string | null;
    incomes: Array<{
      typeName: string | null;
      sourceName: string | null;
      amountMonthly: number | null;
      tenureMonths: number | null;
    }>;
    monthlyIncomeTotal: number;
    obligations: Array<{
      lender: string | null;
      description: string | null;
      loanAmount: number | null;
      monthlyPayment: number | null;
      monthsRemaining: number | null;
      /** True when months_remaining > 18 (or unknown — banks treat unknown
       *  conservatively as long-term). Used to highlight bank-relevant debt. */
      isLongTerm: boolean;
    }>;
    monthlyObligationsTotal: number;
    /** Sum of monthly payments for obligations with >18 months remaining.
     *  Banks only count these against DTI. */
    monthlyObligationsLongTermTotal: number;
    remainingDebtTotal: number;
  }>;
  totals: {
    /** Income/obligations split by role — banks weight ערב differently. */
    borrowersIncomeMonthly: number;
    borrowersObligationsLongTermMonthly: number;
    guarantorsIncomeMonthly: number;
    guarantorsObligationsLongTermMonthly: number;
    grandIncomeMonthly: number;
    grandObligationsMonthly: number;
    grandObligationsLongTermMonthly: number;
    grandRemainingDebt: number;
    /** Income left after deducting long-term obligations. This is what's
     *  available for a new mortgage payment. */
    availableIncomeMonthly: number;
    /** DTI = monthly obligations / monthly income (×100). null when income=0. */
    dtiPercent: number | null;
    /** Possible monthly mortgage payment at common DTI bands (30/34/38%).
     *  Formula matches the standard mortgage-advisor output:
     *  `available_income × ratio`. */
    paymentBands: ReadonlyArray<{ ratio: number; payment: number }>;
  };
};

export async function loadCaseForBankPdf(caseId: CaseId): Promise<BankPdfData | null> {
  // getCaseById's embedded case_borrowers query is narrow (only id + names).
  // listBorrowersForCase joins the full borrower row + role_in_case, which is
  // what the PDF needs. Run all three queries in parallel.
  const [caseData, borrowerLinks, incomeGroups, obligationGroups] = await Promise.all([
    getCaseById(caseId),
    listBorrowersForCase(caseId),
    listIncomesForCase(caseId),
    listObligationsForCase(caseId),
  ]);

  if (!caseData) return null;

  // Borrower order: primary first, then guarantors/others.
  const sortedJunction = [...borrowerLinks].sort((a, b) =>
    a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1,
  );

  const borrowers = sortedJunction.map((j) => {
    const b = j.borrower;
    const incomeGroup = incomeGroups.find((g) => g.borrowerId === b.id);
    const obligationGroup = obligationGroups.find((g) => g.borrowerId === b.id);
    const fullName =
      [b.first_name, b.last_name].filter(Boolean).join(' ').trim() || '(ללא שם)';
    const ageYears = b.birth_date
      ? Math.floor(
          (Date.now() - new Date(b.birth_date).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;

    const obligations =
      obligationGroup?.obligations.map((ob) => ({
        lender: ob.lender,
        description: ob.description,
        loanAmount: ob.loan_amount === null ? null : Number(ob.loan_amount),
        monthlyPayment: ob.monthly_payment === null ? null : Number(ob.monthly_payment),
        monthsRemaining: ob.months_remaining,
        isLongTerm: isLongTermObligation(ob.months_remaining),
      })) ?? [];

    const monthlyObligationsLongTermTotal = obligations.reduce(
      (sum, ob) => (ob.isLongTerm && ob.monthlyPayment ? sum + ob.monthlyPayment : sum),
      0,
    );

    return {
      id: b.id,
      fullName,
      role: j.role_in_case,
      isPrimary: j.is_primary,
      nationalId: b.national_id ?? null,
      idIssueDate: b.id_issue_date ?? null,
      idExpiryDate: b.id_expiry_date ?? null,
      birthDate: b.birth_date ?? null,
      ageYears,
      phone: b.phone ?? null,
      email: b.email ?? null,
      address: b.address ?? null,
      citizenship: b.citizenship ?? null,
      residencyType: b.residency_type ?? null,
      maritalStatus: b.marital_status ?? null,
      childrenCount: b.children_count ?? null,
      gender: b.gender ?? null,
      incomes:
        incomeGroup?.incomes.map((inc) => ({
          typeName: inc.income_type?.name_he ?? null,
          sourceName: inc.source_name,
          amountMonthly: inc.amount_monthly === null ? null : Number(inc.amount_monthly),
          tenureMonths: inc.tenure_months,
        })) ?? [],
      monthlyIncomeTotal: incomeGroup?.monthlyTotal ?? 0,
      obligations,
      monthlyObligationsTotal: obligationGroup?.monthlyPaymentTotal ?? 0,
      monthlyObligationsLongTermTotal,
      remainingDebtTotal: obligationGroup?.remainingDebtTotal ?? 0,
    };
  });

  // Role-based splits. Israeli mortgage banks count borrower income at 100%
  // but discount guarantor income heavily — separating them lets the PDF
  // show both numbers transparently.
  const isBorrower = (b: (typeof borrowers)[number]) => b.role === 'borrower';
  const isGuarantor = (b: (typeof borrowers)[number]) => b.role === 'guarantor';
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const borrowersIncomeMonthly = sum(borrowers.filter(isBorrower).map((b) => b.monthlyIncomeTotal));
  const borrowersObligationsLongTermMonthly = sum(
    borrowers.filter(isBorrower).map((b) => b.monthlyObligationsLongTermTotal),
  );
  const guarantorsIncomeMonthly = sum(
    borrowers.filter(isGuarantor).map((b) => b.monthlyIncomeTotal),
  );
  const guarantorsObligationsLongTermMonthly = sum(
    borrowers.filter(isGuarantor).map((b) => b.monthlyObligationsLongTermTotal),
  );

  const grandIncomeMonthly = sum(borrowers.map((b) => b.monthlyIncomeTotal));
  const grandObligationsMonthly = sum(borrowers.map((b) => b.monthlyObligationsTotal));
  const grandObligationsLongTermMonthly = sum(
    borrowers.map((b) => b.monthlyObligationsLongTermTotal),
  );
  const grandRemainingDebt = sum(borrowers.map((b) => b.remainingDebtTotal));

  const availableIncomeMonthly = calculateAvailableIncome(
    borrowersIncomeMonthly,
    borrowersObligationsLongTermMonthly,
  );

  const advisorName =
    [caseData.assigned_advisor?.first_name, caseData.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

  return {
    case: {
      caseNumber: caseData.case_number,
      createdAt: caseData.created_at,
      statusName: caseData.status?.name_he ?? null,
      propertyValue: caseData.property_value,
      requestedAmount: caseData.requested_mortgage_amount,
      equity: caseData.equity,
      ltv: calculateLtv(caseData.property_value, caseData.requested_mortgage_amount),
    },
    advisorName,
    advisorPhone: caseData.assigned_advisor?.phone ?? null,
    advisorEmail: caseData.assigned_advisor?.email ?? null,
    borrowers,
    totals: {
      borrowersIncomeMonthly,
      borrowersObligationsLongTermMonthly,
      guarantorsIncomeMonthly,
      guarantorsObligationsLongTermMonthly,
      grandIncomeMonthly,
      grandObligationsMonthly,
      grandObligationsLongTermMonthly,
      grandRemainingDebt,
      availableIncomeMonthly,
      dtiPercent: calculateDtiPercent(grandObligationsMonthly, grandIncomeMonthly),
      paymentBands: calculateDtiBands(availableIncomeMonthly),
    },
  };
}
