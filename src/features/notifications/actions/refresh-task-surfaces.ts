'use server';

import { refresh, revalidatePath } from 'next/cache';

/**
 * Reconcile task-backed surfaces after a realtime notification arrives.
 *
 * The database trigger creates the notification outside the recipient's current
 * RSC request, so the bell can update locally while the task page/sidebar still
 * show their previous server-rendered snapshot. Calling this as a follow-up
 * Server Action lets Next invalidate the affected routes and stream back fresh
 * UI to only the notified browser.
 */
export async function refreshTaskSurfacesAction(): Promise<void> {
  revalidatePath('/tasks');
  revalidatePath('/(app)', 'layout');
  refresh();
}
