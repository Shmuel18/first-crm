// Raw row shape for public.case_payouts (migration 186). Declared locally
// because the table lands in the generated Database types only after a types
// regen — same untyped-handle pattern as case_properties / case_comments.
export type CasePayoutRow = {
  id: string;
  case_id: string;
  recipient: string | null;
  amount: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};
