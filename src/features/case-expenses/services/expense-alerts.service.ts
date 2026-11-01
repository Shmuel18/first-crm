import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Reports expenses that got an amount but no description within 15 minutes —
 * the trigger only alerts once the expense is complete, so without this sweep
 * an amount-only expense would never reach the owner (migration 258). Runs on
 * the 15-minute cron tick; the RPC claims each expense once.
 */
export async function runUndescribedExpenseAlerts(): Promise<{ notified: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('alert_undescribed_expenses');
  if (error) throw new Error(`alert_undescribed_expenses failed: ${error.message}`);
  return { notified: data ?? 0 };
}
