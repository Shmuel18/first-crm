'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function softDeleteCaseAction(caseId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('cases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', caseId);

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath('/cases');
  redirect('/cases');
}

export async function toggleArchiveAction(caseId: string, archive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('cases')
    .update({ is_archived: archive })
    .eq('id', caseId);

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
}

export async function updateCaseStatusAction(
  caseId: string,
  statusId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId);

  if (error) {
    throw new Error(error.message);
  }
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
}
