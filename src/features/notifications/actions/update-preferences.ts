'use server';

import { revalidatePath } from 'next/cache';

import { updateMyNotificationPreferences } from '../services/preferences.service';

export type PrefsActionState = { status: 'idle' | 'saved' | 'error' };
export const PREFS_ACTION_INITIAL: PrefsActionState = { status: 'idle' };

export async function updateNotificationPreferencesAction(
  _prevState: PrefsActionState,
  formData: FormData,
): Promise<PrefsActionState> {
  // Unchecked switches are simply absent from the form data.
  const ok = await updateMyNotificationPreferences({
    email_task_assigned: formData.has('email_task_assigned'),
    email_task_completed: formData.has('email_task_completed'),
  });
  if (!ok) return { status: 'error' };

  revalidatePath('/settings/notifications');
  return { status: 'saved' };
}
