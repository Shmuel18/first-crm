import { VANISHED_FILE_GRACE_PERIOD_MS } from '@/features/integrations/domain/drive-sync-types';

/**
 * A doc whose Drive file vanished carries `metadata.drive_missing_since`
 * (stamped by the sync sweeper). It is NOT removed immediately — the sweeper
 * waits out a grace window so a Drive Desktop hiccup or an accidental
 * drag-out can't wipe real documents in one cycle. The UI surfaces the
 * pending removal so "I deleted it in Drive and nothing happened" reads as
 * "we saw it, here's when it goes" — with a button to remove it now.
 */
export type DriveMissingInfo = { missingSince: string; hoursLeft: number };

export function readDriveMissing(
  metadata: unknown,
  nowMs: number = Date.now(),
): DriveMissingInfo | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).drive_missing_since;
  if (typeof raw !== 'string') return null;
  const sinceMs = new Date(raw).getTime();
  if (Number.isNaN(sinceMs)) return null;
  const leftMs = sinceMs + VANISHED_FILE_GRACE_PERIOD_MS - nowMs;
  return { missingSince: raw, hoursLeft: Math.max(0, Math.ceil(leftMs / 3_600_000)) };
}
