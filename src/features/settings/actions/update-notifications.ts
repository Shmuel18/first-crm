'use server';

import { revalidatePath } from 'next/cache';

import { updateMyNotificationPreferences } from '@/features/notifications/services/preferences.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { SlaFormSchema, formInputToThresholds } from '../schemas/sla.schema';
import type { SettingsActionState } from '../types';

/**
 * Unified notifications-page save. Replaces the two split actions
 * (updateNotificationPreferencesAction + updateSlaAction) so the page
 * has a single submit button + single round trip.
 *
 * Always saves:
 *   - The current user's email-notification preferences (toggles).
 *
 * Admin-only — saves when isAdmin():
 *   - Per-status SLA thresholds on office_settings (singleton row id=1).
 *
 * If validation on the SLA section fails, the whole action is treated as
 * a validation failure — we'd rather refuse the partial save than commit
 * preferences and bounce the SLA half (which would leave the visible form
 * out of sync with what was actually written).
 */
export async function updateNotificationsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const isAdmin = await isCurrentUserAdmin();

  // ── Validate SLA fields up front (admin only) ─────────────────────────
  // The form posts every `sla_*` input even when admins haven't touched it,
  // so safeParse covers any stray edits. Non-admins never see the inputs;
  // any sla_* field in their POST is silently ignored.
  let thresholds: ReturnType<typeof formInputToThresholds> | null = null;
  if (isAdmin) {
    const parsed = SlaFormSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      const fieldErrors = await resolveSchemaErrors(parsed.error);
      return {
        ok: false,
        error: 'validation',
        fieldErrors,
        values: formDataToValues(formData),
      };
    }
    thresholds = formInputToThresholds(parsed.data);
  }

  // ── Save email preferences (every caller) ─────────────────────────────
  // Unchecked switches are absent from FormData → upserted as false.
  const prefsOk = await updateMyNotificationPreferences({
    email_task_assigned: formData.has('email_task_assigned'),
    email_task_completed: formData.has('email_task_completed'),
  });
  if (!prefsOk) return { ok: false, error: 'unknown' };

  // ── Save SLA thresholds (admin only) ──────────────────────────────────
  if (isAdmin && thresholds !== null) {
    const { data: updated, error } = await supabase
      .from('office_settings')
      .update({
        sla_status_thresholds: thresholds,
        updated_by: userRes.user.id,
      })
      .eq('id', 1)
      .select('id');

    if (error) {
      console.error('[update-notifications] sla update failed', { message: error.message });
      return { ok: false, error: 'unknown' };
    }
    if (!updated || updated.length === 0) {
      // RLS denied even though isAdmin returned true — surface as unauthorized
      // rather than masking the policy mismatch.
      return { ok: false, error: 'unauthorized' };
    }
  }

  revalidatePath('/settings/notifications');
  return { ok: true };
}
