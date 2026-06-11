import type { Json } from '@/types/database';

/**
 * Per-field old/new pair for an UPDATE. For INSERT/DELETE the trigger logs
 * the whole row instead, so we expose `wholeRow` (the raw JSONB) for those.
 */
export type AuditFieldChange = { old: Json | null; new: Json | null };
export type AuditChangeMap = Record<string, AuditFieldChange>;

export type AuditEntry = {
  id: string;
  action: string;
  tableName: string;
  recordId: string;
  timestamp: string;
  actorName: string | null;
  /**
   * For UPDATEs: the parsed { field: { old, new } } diff.
   * For INSERT/DELETE: null (the audit row stored the whole record under
   * `wholeRow` instead — useful for showing what was created/removed).
   */
  changes: AuditChangeMap | null;
  /** INSERT/DELETE only — the entire row that was created or removed. */
  wholeRow: Record<string, Json | null> | null;
};

export type AuditRow = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  timestamp: string;
  changed_fields: Json | null;
  user_id: string | null;
};

/**
 * For an UPDATE row, the trigger stores `{ field: { old, new } }`. Coerce
 * loose JSONB into our typed shape; entries that don't look like a diff
 * (i.e. INSERT/DELETE rows where the whole row is stored) return null so
 * the caller knows to fall back to `wholeRow`.
 */
/**
 * Internal/technical columns hidden from the audit display so the history
 * stays readable: the `metadata` JSONB (which holds storage_path / source /
 * etc.), the Drive sync ids, file size/mime, the who/when verification
 * stamps (already conveyed by the entry's actor + timestamp), and the
 * optimistic-locking `version` counter (bumped by trigger on every write —
 * pure bookkeeping, meaningless to the office). Applies to every table —
 * none are user-meaningful as a diff.
 */
const HIDDEN_FIELDS = new Set([
  'metadata',
  'drive_file_id',
  'drive_file_url',
  'file_size',
  'mime_type',
  'uploaded_by',
  'verified_by',
  'verified_at',
  'version',
]);

export function extractChanges(action: string, changed: Json | null): AuditChangeMap | null {
  if (action !== 'UPDATE') return null;
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return null;
  const out: AuditChangeMap = {};
  for (const [key, val] of Object.entries(changed)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && 'old' in val && 'new' in val) {
      const pair = val as { old: Json | null; new: Json | null };
      out[key] = { old: pair.old, new: pair.new };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function extractWholeRow(
  action: string,
  changed: Json | null,
): Record<string, Json | null> | null {
  if (action !== 'INSERT' && action !== 'DELETE') return null;
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return null;
  return changed as Record<string, Json | null>;
}

/** Walk a JSONB object collecting any FK ids we know how to resolve. */
export function collectFkIds(
  source: AuditChangeMap | Record<string, Json | null> | null,
  acc: Map<string, Set<string>>,
): void {
  if (!source) return;
  for (const [field, val] of Object.entries(source)) {
    if (val === null || val === undefined) continue;
    // UPDATE: { old, new } pair
    if (typeof val === 'object' && !Array.isArray(val) && 'old' in val && 'new' in val) {
      for (const candidate of [val.old, val.new]) {
        if (typeof candidate === 'string' && candidate.length > 0) {
          if (!acc.has(field)) acc.set(field, new Set());
          acc.get(field)!.add(candidate);
        }
      }
      continue;
    }
    // INSERT/DELETE: bare value
    if (typeof val === 'string') {
      if (!acc.has(field)) acc.set(field, new Set());
      acc.get(field)!.add(val);
    }
  }
}

/** Mutate a JSONB object in-place, replacing FK ids with their resolved
 *  display name when available. Leaves unknown ids untouched. */
export function substituteFkValues(
  source: AuditChangeMap | Record<string, Json | null> | null,
  lookups: Map<string, Map<string, string>>,
): void {
  if (!source) return;
  for (const [field, val] of Object.entries(source)) {
    const lookup = lookups.get(field);
    if (!lookup) continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && 'old' in val && 'new' in val) {
      const pair = val as AuditFieldChange;
      if (typeof pair.old === 'string') pair.old = lookup.get(pair.old) ?? pair.old;
      if (typeof pair.new === 'string') pair.new = lookup.get(pair.new) ?? pair.new;
      continue;
    }
    if (typeof val === 'string') {
      (source as Record<string, Json | null>)[field] = lookup.get(val) ?? val;
    }
  }
}
