# Restore & Recovery Runbook

> **Operator doc.** Read this *before* an incident, not during one.
> Verified against the code on 2026-06-01. The authoritative behavior lives in
> `supabase/migrations/030_restore_backup_rpc.sql` (current definition:
> `058_restore_strip_deleted_at.sql`), `src/features/backup/`, and
> `src/lib/crypto/secrets.ts`. If this doc and the code ever disagree, the code wins —
> re-verify and fix this doc.

---

## Recovery decision guide (start here)

Pick the row that matches what actually went wrong. Using the wrong tool can make recovery
*look* like it worked while leaving the bad data in place.

| What happened | Use this | What it does / does NOT do |
|---|---|---|
| **Accidental MASS DELETE** — rows are *gone* (e.g. someone deleted a batch of cases/borrowers, a runaway script wiped a table) | **Drive "Restore"** (Settings → Backup) | **Re-inserts the missing rows only (merge).** It does **NOT** overwrite rows that still exist, and it preserves anything created after the backup. Safe to run; it can only *add back* deleted rows. |
| **DATA CORRUPTION / BAD EDITS** — rows still exist but hold wrong values (a bad migration updated many rows, a buggy action overwrote fields, someone edited the wrong record) | **Supabase PITR** (Point-in-Time Recovery), **NOT** the Drive restore | PITR rolls the whole DB back to a chosen timestamp. The Drive restore **cannot fix this** — it is merge-only (`ON CONFLICT DO NOTHING`), so the corrupted row already exists and is left untouched. |
| **"Roll the database back to how it was at 13:55 today"** | **Supabase PITR** | Same reason — only PITR can undo changes. The Drive snapshot is a point-in-time *additive* copy, not a rollback. |
| **App/code regression** — the DB is fine but the deployed app is broken (bad build, broken page, regression) | **App-level rollback** (Docker image / previous dir) | Swaps the running code back. Does **not** touch data. See [§4](#4-app-level-rollback-code-not-data). |

**One-line mental model:** Drive Restore = "put back what was *deleted*." PITR = "undo what was *changed*."

---

## 1. What the Drive "Restore" actually does (merge-only)

Path: `backup-restore-button.tsx` → `actions/restore-backup.ts` → `services/restore.service.ts`
→ RPC `restore_backup_snapshot`.

The RPC (`supabase/migrations/030_restore_backup_rpc.sql`, header lines 3-7) is **MERGE-ONLY**.
Each table is restored with:

```sql
INSERT INTO public.<table> SELECT * FROM jsonb_populate_recordset(...) ON CONFLICT DO NOTHING
```

Consequences you must understand before relying on it:

- ✅ **Re-inserts rows that were deleted** since the backup was taken.
- ❌ **Never overwrites an existing row.** A row that is still present (even if its data is now
  wrong/corrupted) hits `ON CONFLICT DO NOTHING` and is left exactly as-is. **This is why
  Restore cannot repair corruption or bad edits — use PITR for that.**
- ✅ **Preserves rows created after the backup** (they aren't in the snapshot, so nothing deletes them).
- 🔒 **Admin-only** (`is_admin()` check) and the table list is **hardcoded in SQL** — a crafted
  backup file can't write to arbitrary tables. `office_integrations` (OAuth tokens) and `auth.*`
  are intentionally excluded, so Drive auth and login users are **not** restored by this path.

> ⚠️ **Known gap (open issue):** the restore RPC's hardcoded table list does **not** include
> `mortgage_scenarios` / `scenario_tracks`, even though they *are* written to the backup. Until
> that is fixed, saved simulator scenarios are **not** recovered by a Drive restore. Verify before
> relying on it for scenario data.

---

## 2. When to use Supabase PITR instead

For **corruption, bad edits, or any "roll back to a point in time"**, the Drive restore is the wrong
tool (it's merge-only — see §1). Use **Supabase Point-in-Time Recovery**.

- PITR requires the **Supabase Pro tier** ($25/mo). Confirm it's enabled:
  **Supabase Dashboard → Settings → Database → "Point in Time Recovery — 7 days enabled".**
- Background and rationale already documented in:
  - `docs/KAUFMAN_GO_LIVE.md` §1.1 "Upgrade Supabase project to Pro" (lines 11-18)
  - `docs/AUDIT_HANDOFF.md` §1b "Confirm PITR is enabled" (lines 20-23)
- PITR restores the **entire database** to a chosen timestamp (this also undoes *good* changes made
  after that point — accept the trade-off, or export the few good rows first).

If you are unsure which tool applies: if the rows still **exist** but are **wrong** → PITR. If the rows
are **gone** → Drive restore can bring them back.

---

## 3. Getting a backup file if Drive OAuth is broken

The in-app Restore needs the app up **and** Google Drive connected. During a real incident neither may
hold. To get a snapshot manually:

1. **Download from Drive directly.** The backups live in the Google Drive folder **`KFG_Backups`**
   (constant `BACKUP_FOLDER_NAME` in `src/features/backup/services/drive-backup.service.ts`).
   Open Drive in a browser → `KFG_Backups` → download the file for the target date. Files are uploaded
   as `application/octet-stream` (Drive won't preview them — that's expected; the contents are
   encrypted, not JSON).

2. **Decrypt it.** The file is **AES-256-GCM** encrypted with the **`BACKUP_ENCRYPTION_KEY`** secret.
   The first bytes are a version prefix:
   - **`enc:v2:`** — used when `BACKUP_ENCRYPTION_SALT_V2` is configured (the current/preferred scheme).
     The scrypt salt is the value of the **`BACKUP_ENCRYPTION_SALT_V2`** env var.
   - **`enc:v1:`** — used when no v2 salt is wired. The salt is the fixed code-baked string
     `kfg-integration-secrets-v1`.
   - *(Very old/legacy snapshots may be plaintext `.json` with no prefix.)*

   Envelope after the prefix: `base64( IV[12 bytes] ‖ GCM auth tag[16 bytes] ‖ ciphertext )`, with the
   key derived as `scrypt(BACKUP_ENCRYPTION_KEY, salt, 32)`.

   **Safest way to decrypt offline:** reuse the project's own `decryptWithKey` from
   `src/lib/crypto/secrets.ts` (a few lines of Node) rather than hand-rolling `openssl` — the prefix
   routing, salt, scrypt params, and IV/tag slicing must match exactly, and the repo function already
   does. Sketch:

   ```js
   // node, run from the repo root
   import { readFileSync } from 'node:fs';
   import { decryptWithKey } from './src/lib/crypto/secrets.ts';
   const text = readFileSync('KFG_Backups_2026-06-01.bin', 'utf8'); // the downloaded file
   const json = decryptWithKey(text, process.env.BACKUP_ENCRYPTION_KEY, {
     saltV2: process.env.BACKUP_ENCRYPTION_SALT_V2, // required only for enc:v2: files
   });
   // `json` is the snapshot: { version: 1, ..., data: { <table>: [...] } }
   ```

   You then have the snapshot JSON to inspect, or to feed back through the Restore action once the app
   is reachable.

> Keep `BACKUP_ENCRYPTION_KEY` (and `BACKUP_ENCRYPTION_SALT_V2`, if set) recorded somewhere **outside**
> this server. A backup you cannot decrypt is not a backup.

---

## 4. App-level rollback (code, not data)

If the **deployed app** is broken but the database is fine, roll the code back — this does **not**
touch data. Per `docs/FRANKFURT_MIGRATION_HANDOFF.md` (Rollback options, lines 138-141):

- **Docker image:** `first-crm:prev` (the previous image, tagged on every deploy)
- **Previous directory:** `/opt/first-crm_prev`

SSH to the host and re-run the previous image / swap back to the previous directory. See the Frankfurt
handoff for the full deploy/rollback flow.

---

## 5. Before you ever need this (prep checklist)

- [ ] **PITR is actually on** (Pro tier) — the only tool for corruption/bad-edit recovery (§2).
- [ ] You can reach `BACKUP_ENCRYPTION_KEY` (and `BACKUP_ENCRYPTION_SALT_V2`) from **off this server**.
- [ ] **Dry-run a restore once** on non-prod: download a real `KFG_Backups` file, decrypt it (§3),
      and run the Restore action — confirm it round-trips before you depend on it in a crisis.
- [ ] Confirm the **nightly backup is actually running** and a fresh file lands in `KFG_Backups`
      (on a self-hosted/Vultr deploy the Vercel cron does **not** fire — a host scheduler must invoke
      `/api/cron/backup`; verify a file exists for today).
