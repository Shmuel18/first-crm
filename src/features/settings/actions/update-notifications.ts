'use server';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';
import type { Json } from '@/types/database';

import {
  SlaFormSchema,
  formInputToThresholds,
  type SlaStatusKey,
  type SlaThresholdsPatch,
} from '../schemas/sla.schema';
import { listSlaStatuses } from '../services/sla.service';
import type { SettingsActionState } from '../types';

/**
 * Unified notifications-page save. Wraps email-pref + SLA writes in ONE
 * SECURITY DEFINER RPC (migration 070) so a SLA write failure rolls back
 * the prefs upsert atomically — no more half-commits where the user sees
 * "save failed" but their email-toggle change persisted.
 *
 * Flow:
 *   - Always saves the current user's email-notification preferences.
 *   - Admin-only: validates per-status SLA thresholds via Zod, then merges
 *     them into office_settings.sla_status_thresholds (merge — not replace
 *     — so thresholds for now-inactive statuses survive a save).
 *   - If validation fails, neither write happens (validation gate runs
 *     before the RPC call).
 *
 * Non-admin smuggling: the RPC double-checks `is_admin()` server-side and
 * silently drops p_sla for non-admins, mirroring the action's `isAdmin`
 * branch here as defense-in-depth.
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
  // Form posts every `sla_*` input even when admins haven't touched it,
  // so safeParse covers any stray edits. Non-admins never see the inputs;
  // even if they smuggle sla_* in the POST, the RPC drops it.
  let slaThresholds: Json | null = null;
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

    // formInputToThresholds emits every SLA key with `number | null`. The
    // form ONLY renders inputs for active statuses, but Zod's preprocess
    // turns missing fields into null too — so the raw patch would contain
    // `null` for deactivated statuses, which the RPC interprets as "clear".
    // Filter to the active-status set so deactivated thresholds survive.
    const activeStatuses = await listSlaStatuses();
    const activeKeys = new Set(activeStatuses.map((s) => s.key));
    const fullPatch = formInputToThresholds(parsed.data);
    const filteredPatch: SlaThresholdsPatch = {};
    for (const [k, v] of Object.entries(fullPatch)) {
      if (activeKeys.has(k as SlaStatusKey)) {
        filteredPatch[k as SlaStatusKey] = v;
      }
    }
    slaThresholds = filteredPatch as unknown as Json;
  }

  // ── Atomic write via RPC ──────────────────────────────────────────────
  const { error } = await supabase.rpc('save_notification_settings', {
    p_email_task_assigned: formData.has('email_task_assigned'),
    p_email_task_completed: formData.has('email_task_completed'),
    p_email_mentions: formData.has('email_mentions'),
    p_email_task_reminder: formData.has('email_task_reminder'),
    p_email_case_status_overdue: formData.has('email_case_status_overdue'),
    // Conditional: admin who skipped SLA entirely (e.g., no `sla_*` fields)
    // sends null → RPC skips the SLA block. Admin who included SLA sends
    // the merge-patch object.
    p_sla: slaThresholds ?? undefined,
  });

  if (error) {
    if (error.code === '42501') {
      // RPC's auth.uid() / is_admin gate raised — surface as unauthorized.
      return { ok: false, error: 'unauthorized' };
    }
    console.error('[update-notifications] rpc error', { code: error.code, message: error.message });
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath: the form is controlled, so it keeps the saved values on
  // screen, and the page re-fetches fresh on the next visit. Dropping the
  // round-trip also fixes the Save-spinner hang.
  return { ok: true };
}
