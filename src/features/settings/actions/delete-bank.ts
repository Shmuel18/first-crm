'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { bankInUse } from '../services/banks.service';

export type DeleteBankResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'system' | 'in_use' | 'unknown' };

/**
 * Hard-delete a lender. Refused for system (seeded) lenders and for any lender
 * still referenced by a case — those should be deactivated (is_active=false)
 * instead so existing cases keep their data.
 */
export async function deleteBankAction(id: string): Promise<DeleteBankResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: bank } = await supabase
    .from('banks')
    .select('is_system')
    .eq('id', id)
    .maybeSingle();
  if (!bank) return { ok: false, error: 'not_found' };
  if (bank.is_system) return { ok: false, error: 'system' };
  if (await bankInUse(id)) return { ok: false, error: 'in_use' };

  const { error } = await supabase.from('banks').delete().eq('id', id);
  if (error) {
    // 23503 = FK violation: referenced by a table bankInUse doesn't cover
    // (e.g. the mig-106 simulator market-data tables) or a case added between
    // the check and the delete. Surface the accurate "in use" message instead
    // of a generic failure — the DB's NO ACTION FK is the real guard.
    if (error.code === '23503') return { ok: false, error: 'in_use' };
    console.error('[deleteBank] delete failed', error.code);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/settings/banks');
  return { ok: true };
}
