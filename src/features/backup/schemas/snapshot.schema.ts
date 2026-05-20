import { z } from 'zod';

/**
 * Envelope validation for a backup file before it is handed to the restore
 * RPC. Row contents stay `unknown` — the database function maps them column by
 * column via jsonb_populate_recordset and ignores anything that doesn't fit.
 */
export const BackupSnapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  counts: z.record(z.string(), z.number()).optional(),
  data: z.record(z.string(), z.array(z.unknown())),
});

export type BackupSnapshot = z.infer<typeof BackupSnapshotSchema>;
