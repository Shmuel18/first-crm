'use server';

import { createClient } from '@/lib/supabase/server';

export type RemoveCasePropertyResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown' };

type RpcClient = {
  rpc: (
    fn: 'soft_delete_case_property',
    args: { p_case_id: string; p_property_id: string },
  ) => PromiseLike<{ error: { message: string; code?: string } | null }>;
};

/**
 * Soft-delete an additional property via the SECURITY DEFINER RPC (migration
 * 156), which re-checks edit access + case ownership. No revalidatePath — the
 * client removes the row optimistically.
 */
export async function removeCasePropertyAction(
  caseId: string,
  propertyId: string,
): Promise<RemoveCasePropertyResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Call .rpc as a method on the cast client so supabase-js keeps its `this`.
  const { error } = await (supabase as unknown as RpcClient).rpc('soft_delete_case_property', {
    p_case_id: caseId,
    p_property_id: propertyId,
  });

  if (error) {
    if (error.code === '42501') return { ok: false, error: 'unauthorized' };
    console.error('[remove-case-property] error', error.message);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
