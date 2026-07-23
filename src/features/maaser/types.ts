/** One charity donation in the manager's ma'aser ledger (money in ₪). */
export type MaaserPayment = {
  id: string;
  paidOn: string; // YYYY-MM-DD
  amount: number;
  recipient: string | null;
  note: string | null;
};

/** A manual ledger line either adds income or subtracts an expense from the base. */
export type MaaserEntryKind = 'income' | 'expense';

/** One manually-entered income / expense line adjusting the ma'aser base. */
export type MaaserEntry = {
  id: string;
  entryDate: string; // YYYY-MM-DD
  kind: MaaserEntryKind;
  amount: number;
  description: string | null;
};
