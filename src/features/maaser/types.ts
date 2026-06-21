/** One charity donation in the manager's ma'aser ledger (money in ₪). */
export type MaaserPayment = {
  id: string;
  paidOn: string; // YYYY-MM-DD
  amount: number;
  recipient: string | null;
  note: string | null;
};
