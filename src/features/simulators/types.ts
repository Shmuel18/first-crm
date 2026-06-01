import type {
  BorrowerId,
  CaseId,
  MortgageScenarioId,
  ScenarioTrackId,
} from '@/lib/types/branded';

export type { MortgageScenarioId, ScenarioTrackId };

export type TrackType =
  | 'fixed_unlinked'
  | 'fixed_linked'
  | 'prime'
  | 'variable_unlinked'
  | 'variable_linked'
  | 'eligibility';

export type RepaymentType = 'spitzer' | 'equal_principal' | 'balloon';
export type ScenarioKind = 'mix' | 'comparison' | 'scenario' | 'capacity' | 'early_repayment' | 'refinance';
export type SimulatorKind =
  | ScenarioKind
  | 'max_mortgage'
  | 'dti'
  | 'ltv'
  | 'monthly_payment'
  | 'prime_impact'
  | 'cpi_impact'
  | 'fixed_variable_compare'
  | 'repayment_type_compare'
  | 'balloon_bullet'
  | 'purchase_tax'
  | 'closing_costs'
  | 'guarantor_impact'
  | 'bank_offer_comparison'
  | 'best_bank_fit'
  | 'approval_probability'
  | 'rent_vs_buy'
  | 'client_report';
export type PropertyKind = 'first_home' | 'replacement' | 'investment';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ScenarioPresetKey = 'calm' | 'moderate' | 'strict' | 'custom';

export type MoneyAgorot = number;

export interface TrackInput {
  id: string;
  type: TrackType;
  amount: MoneyAgorot;
  annualRatePct: number;
  termMonths: number;
  repayment: RepaymentType;
  cpiAnnualPct: number | null;
  graceMonths: number | null;
}

export interface MixInput {
  mortgageAmount: MoneyAgorot;
  propertyValue: MoneyAgorot;
  equity: MoneyAgorot;
  defaultTermMonths: number;
  tracks: ReadonlyArray<TrackInput>;
}

export interface AmortizationRow {
  monthIndex: number;
  payment: MoneyAgorot;
  interest: MoneyAgorot;
  principal: MoneyAgorot;
  indexation: MoneyAgorot;
  closingBalance: MoneyAgorot;
}

export interface CurvePoint {
  monthIndex: number;
  value: MoneyAgorot;
}

export interface TrackResult {
  trackId: string;
  rows: ReadonlyArray<AmortizationRow>;
  firstPayment: MoneyAgorot;
  averagePayment: MoneyAgorot;
  maxPayment: MoneyAgorot;
  totalInterest: MoneyAgorot;
  totalIndexation: MoneyAgorot;
  totalCost: MoneyAgorot;
  costPerShekel: number;
  balanceAt: { y5: MoneyAgorot; y10: MoneyAgorot; y15: MoneyAgorot };
}

export interface MixResult {
  tracks: ReadonlyArray<TrackResult>;
  firstPayment: MoneyAgorot;
  averagePayment: MoneyAgorot;
  maxPayment: MoneyAgorot;
  /** 1-based month index where the aggregate payment peaks (0 when empty). */
  maxPaymentMonth: number;
  totalInterest: MoneyAgorot;
  totalIndexation: MoneyAgorot;
  totalCost: MoneyAgorot;
  /** Total cost ÷ borrowed principal — ₪ repaid per ₪ borrowed. */
  costPerShekel: number;
  /** Amount-weighted average effective annual rate across tracks (%). */
  weightedRatePct: number;
  ltv: number | null;
  paymentCurve: ReadonlyArray<CurvePoint>;
  balanceCurve: ReadonlyArray<CurvePoint>;
  /** Per-month principal portion of the aggregate payment. */
  principalCurve: ReadonlyArray<CurvePoint>;
  /** Per-month interest portion of the aggregate payment. */
  interestCurve: ReadonlyArray<CurvePoint>;
  balanceAt: { y5: MoneyAgorot; y10: MoneyAgorot; y15: MoneyAgorot };
}

export interface ScenarioRecordInput {
  id?: MortgageScenarioId;
  caseId: CaseId | null;
  primaryBorrowerId: BorrowerId | null;
  kind: ScenarioKind;
  title: string;
  propertyKind: PropertyKind;
  mix: MixInput;
  advisorConclusion: string | null;
}

export type RegulatoryViolationCode =
  | 'amount_mismatch'
  | 'ltv_exceeded'
  | 'fixed_share_too_low'
  | 'prime_share_too_high'
  | 'equal_principal_share_too_high'
  | 'term_too_long';

export interface RegulatoryViolation {
  code: RegulatoryViolationCode;
  actual: number;
  limit: number;
}

export interface RegulatoryThresholds {
  maxLtvPct: Record<PropertyKind, number>;
  minFixedPct: number;
  maxPrimePct: number;
  maxEqualPrincipalPct: number;
  maxTermMonths: number;
}

