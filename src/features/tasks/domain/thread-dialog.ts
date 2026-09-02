import type { TaskWithRelations } from '../types';

/**
 * Which task the conversation dialog shows: the deep-linked one when the live
 * `?thread=<id>` param names the task the server resolved, else whatever the
 * reader opened from a row.
 *
 * The URL wins, and the comparison is against the LIVE param rather than a
 * mount-time seed, for one reason: the tasks page is not remounted by a
 * search-param navigation, and the param is cleared shallowly when the dialog
 * closes (so `resolved` stays the old task). Deriving from the param means a
 * second notification for the SAME task — the normal shape of a comment
 * conversation — reopens it after the reader closed it, and a notification for
 * a different task swaps to it the moment the server resolves it.
 *
 * `resolved` can lag the param by one server round-trip (param already Y,
 * prop still X); returning null for that frame is correct — it opens on the
 * next render with the right task rather than flashing the wrong one.
 */
export function resolveThreadDialogTask(
  threadId: string | null,
  resolved: TaskWithRelations | null,
  opened: TaskWithRelations | null,
): TaskWithRelations | null {
  const linked = threadId !== null && resolved?.id === threadId ? resolved : null;
  return linked ?? opened;
}
