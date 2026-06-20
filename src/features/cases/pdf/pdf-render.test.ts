import { createElement as h } from 'react';

import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';

import { aggregateMix } from '@/features/simulators/domain/mix-aggregate';
import { ReportDocument } from '@/features/simulators/pdf/report-document';
import type { ScenarioReportData } from '@/features/simulators/pdf/report-data.service';
import type { MixInput } from '@/features/simulators/types';

import type { BankPdfData } from './bank-pdf-data.service';
import { BankPdfDocument } from './bank-pdf-document';

/**
 * Render smoke + regression guard for the react-pdf RTL crash.
 *
 * @react-pdf/textkit 6.3.0 crashes ("Cannot read properties of undefined
 * (reading 'id')" in reorderLine) when a Hebrew bank PDF and a Hebrew report are
 * rendered in the SAME process — the realistic warm-server pattern. We fix it
 * with a fail-soft guard in textkit via patch-package (patches/@react-pdf+textkit
 * +6.3.0.patch). This test interleaves both document types in one process; it
 * passes ONLY with the patch applied, so it fails loudly if the patch is ever
 * dropped. See [[reference_react_pdf_rtl_bidi]].
 */
const bankData: BankPdfData = {
  case: { caseNumber: 'KFG-2026-001', createdAt: '2026-01-15T00:00:00Z', statusName: 'הוגש לבנק', propertyValue: 2000000, requestedAmount: 1400000, equity: 600000, ltv: 70 },
  advisorName: 'משה כהן', advisorPhone: '050-1234567', advisorEmail: 'moshe@kaufman.co.il',
  borrowers: [{
    id: 'b1', fullName: 'ישראל ישראלי', role: 'borrower', isPrimary: true, nationalId: '123456789',
    idIssueDate: '2015-01-01', idExpiryDate: '2025-01-01', birthDate: '1985-06-01', ageYears: 40,
    phone: '050-1111111', email: 'israel@example.com', address: 'רחוב הרצל 1, תל אביב', citizenship: null,
    residencyType: 'resident', maritalStatus: 'married', childrenCount: 2, gender: 'male',
    incomes: [{ typeName: 'שכיר', sourceName: 'חברת הייטק', amountMonthly: 25000, tenureMonths: 60 }],
    monthlyIncomeTotal: 25000,
    obligations: [{ lender: 'בנק לאומי', description: 'הלוואת רכב', loanAmount: 50000, monthlyPayment: 1500, monthsRemaining: 24, isLongTerm: true }],
    monthlyObligationsTotal: 1500, monthlyObligationsLongTermTotal: 1500, remainingDebtTotal: 50000,
  }],
  totals: { borrowersIncomeMonthly: 25000, borrowersObligationsLongTermMonthly: 1500, guarantorsIncomeMonthly: 0, guarantorsObligationsLongTermMonthly: 0, grandIncomeMonthly: 25000, grandObligationsMonthly: 1500, grandObligationsLongTermMonthly: 1500, grandRemainingDebt: 50000, availableIncomeMonthly: 23500, dtiPercent: 6, paymentBands: [{ ratio: 30, payment: 7050 }, { ratio: 34, payment: 7990 }, { ratio: 38, payment: 8930 }] },
  mixes: [
    { title: 'תמהיל 70/30 משופר', tracks: [{ type: 'fixed_unlinked', repayment: 'spitzer', amount: 466667, annualRatePct: 4.5, termMonths: 360, cpiAnnualPct: null }, { type: 'prime', repayment: 'spitzer', amount: 466667, annualRatePct: 6, termMonths: 360, cpiAnnualPct: null }, { type: 'variable_linked', repayment: 'spitzer', amount: 466666, annualRatePct: 4.2, termMonths: 360, cpiAnnualPct: 2.5 }], firstPayment: 7200, minPayment: 6800, maxPayment: 9100, averagePayment: 7900 },
    { title: 'תמהיל שמרני', tracks: [{ type: 'fixed_unlinked', repayment: 'spitzer', amount: 700000, annualRatePct: 4.3, termMonths: 300, cpiAnnualPct: null }, { type: 'prime', repayment: 'spitzer', amount: 700000, annualRatePct: 6, termMonths: 360, cpiAnnualPct: null }], firstPayment: 6900, minPayment: 6500, maxPayment: 8200, averagePayment: 7400 },
  ],
};
const mixInput: MixInput = { mortgageAmount: 140_000_000, propertyValue: 200_000_000, equity: 60_000_000, defaultTermMonths: 360, tracks: [{ id: 't1', type: 'fixed_unlinked', amount: 46_666_700, annualRatePct: 4.5, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: null, graceMonths: null }, { id: 't2', type: 'prime', amount: 46_666_700, annualRatePct: 4.5, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: null, graceMonths: null }, { id: 't3', type: 'variable_linked', amount: 46_666_600, annualRatePct: 4.2, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: 2.5, graceMonths: null }] };
const reportData: ScenarioReportData = { meta: { title: 'תמהיל לדוגמה', kind: 'mix', createdAt: '2026-01-15T00:00:00Z', advisorConclusion: 'מומלץ לקבע 50% מהתמהיל. הסיכון נמוך.' }, caseInfo: { caseNumber: 'KFG-2026-001', advisorName: 'משה כהן' }, loan: { mortgageAmount: 140_000_000, propertyValue: 200_000_000, equity: 60_000_000, termMonths: 360, propertyKind: 'first_home' }, tracks: mixInput.tracks.map((t) => ({ type: t.type, repayment: t.repayment, amount: t.amount, annualRatePct: t.annualRatePct, termMonths: t.termMonths, cpiAnnualPct: t.cpiAnnualPct })), result: aggregateMix(mixInput) };

const isPdf = (b: Buffer): boolean => b.toString('latin1', 0, 5) === '%PDF-';
const bankHe = () => renderToBuffer(h(BankPdfDocument, { data: bankData, locale: 'he' }) as never);
const bankEn = () => renderToBuffer(h(BankPdfDocument, { data: { ...bankData, mixes: [] }, locale: 'en' }) as never);
const reportHe = () => renderToBuffer(h(ReportDocument, { data: reportData, locale: 'he' }) as never);

describe('PDF render', () => {
  it('renders bank + report interleaved in one process without crashing', async () => {
    // Order chosen to exercise the cross-document-type reorder path that crashes
    // textkit 6.3.0 without the patch (bank→report crashes the 2nd render).
    for (const make of [bankHe, reportHe, bankEn, reportHe, bankHe]) {
      const buf = await make();
      expect(isPdf(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(3000);
    }
  }, 60_000);
});
