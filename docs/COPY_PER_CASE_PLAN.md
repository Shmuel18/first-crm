# Copy-per-case borrower model — build plan

**Status:** planned (not started). Owner decision: 2026-06-30, approved scoping + "prepare plan" (option א).

## Goal
Move borrowers from the **shared-identity** model (one row per `national_id`, reused across
cases) to a **copy-per-case** model: each case owns its own borrower row = an independent
snapshot. Same human may appear as multiple rows. Financials follow for free (they FK to
`borrower_id`, no `case_id`). The returning-client detection stays as the safety net so copies
are intentional, and an advisor-controlled "import full profile" step lets the advisor choose
what to bring (profile / + incomes / + obligations) from the client's most recent case.

## Why this is smaller/safer than it looked
- **No financial-schema change.** `borrower_incomes` / `borrower_obligations` FK only to
  `borrower_id`; a fresh borrower row per case is already isolated. The copy model also FIXES
  two latent bugs: (a) editing a shared income mutated other cases, (b) RLS exposed a shared
  borrower's incomes to any case viewer.
- **Tiny prod footprint (read-only check 2026-06-30, prod `uknsayoyvffkxamofczy`):**
  only **4** borrowers are shared across >1 case → **4** copies to create, **4** incomes + **2**
  obligations to clone. 172 active borrowers / 90 cases / 173 links total. The split is hand-verifiable.
- **One atomic migration.** Split + index drop + RPC rewrites + new RPC all fit in a single
  transaction (no `CREATE INDEX CONCURRENTLY` needed on a 172-row table), so the audit's
  "deploy window" risk disappears.

## Phase 1 — DB (one atomic migration `NNN_copy_per_case.sql`)
Order inside the single transaction:

1. **Split existing shared borrowers.** For each `borrower_id` on >1 case
   (`SELECT borrower_id FROM case_borrowers GROUP BY borrower_id HAVING count(DISTINCT case_id)>1`),
   for every case beyond the canonical first:
   - INSERT a clone of the borrower row (new `gen_random_uuid()`, copy all personal columns).
   - INSERT clones of its `borrower_incomes` + `borrower_obligations` rows (`deleted_at IS NULL` only)
     pointing at the new borrower id.
   - Repoint `case_borrowers.borrower_id`, `cases.primary_borrower_id`, and `documents.borrower_id`
     for that case to the new id.
   - Assert per-step row counts; ROLLBACK on any mismatch.
2. **`DROP INDEX IF EXISTS uq_borrowers_national_id;`** (mig 053). Keep/ensure the plain
   `idx_borrowers_national_id` (mig 007) for search.
3. **Rewrite 5 reuse RPCs → always INSERT** (remove the `SELECT … WHERE national_id` dedup,
   the contact-field overwrite ELSE branch, and the `_caller_can_access_borrower` reuse-guard
   on the new-borrower path; keep the `p_borrower_id IS NOT NULL` update path + its "borrower on
   this case" check):
   - `create_case_draft` (mig 201)
   - `save_borrower_for_case_full` (mig 190/201)
   - `convert_lead_to_case` (mig 201 — rich + simple paths)
   - `save_borrower_for_case` (legacy mig 064) — fix **or** `REVOKE EXECUTE` (note: this one was
     never given the ISS-02 guard → it's an open IDOR today regardless; close it here).
   - `import_cases` (mig 168) — remove the `national_id_exists` PASS-1 block; keep `duplicate_in_file`.
4. **Extend `create_case_draft`** to accept, per borrower in `p_borrowers`, optional
   `source_borrower_id` + `copy_incomes` + `copy_obligations`. After inserting each borrower,
   if `source_borrower_id` is set and the flag is on, copy that source borrower's incomes/obligations
   to the new row. Guard: `_caller_can_access_borrower(source_borrower_id)` (the snapshot-source check)
   + the case is the caller's own (created in this RPC). Doing the copy **inside** the RPC keeps it
   atomic and avoids returning a tempId→id map.
5. **Keep `_caller_can_access_borrower`** (re-targeted: now the snapshot-source guard). Add a
   comment that any future cross-case reuse path MUST call it (ISS-02 reminder).
6. Register `schema_version`.

**Validate on Vultr staging DB first** (`eyujzasggzjocsxakkoi`, 2 shared borrowers) via node+pg, with
row-count assertions, before prod.

## Phase 2 — TS / server
- `cases/schemas/case-draft.schema.ts`: add optional `source_borrower_id` (uuid), `copy_incomes`,
  `copy_obligations` to the draft-borrower schema. `DraftBorrower` inherits them automatically.
- `cases/components/new-case-page-client.tsx onSave`: pass the new fields through (already forwards
  the borrower objects).
- `cases/actions/save-case-draft.ts`: no structural change (still one `create_case_draft` call);
  review the 42501 mapping.
- `borrowers/services/borrowers.service.ts` + `RETURNING_MATCH_COLUMNS` + `types.ts ReturningBorrowerMatch`:
  add **case context** (`case_number` / `created_at` of the most-recent case) so the import panel can
  show "from case #X". Source-case resolution: join `case_borrowers → cases` ordered by `cases.created_at DESC`
  (no `opened_at` column exists). Keep `dedupeByNationalId` (now does real work — one suggestion per person).
- Review the `primary_exists` (23505) error mapping at `borrowers.service.ts` — after the index drop
  the only 23505 on that path is `uq_case_borrowers_one_primary`.

## Phase 3 — UI
- `borrowers/components/returning-client-autofill.tsx`: insert a **"what to bring" step** between
  clicking Import and applying — choices: profile only / + incomes / + incomes + obligations — showing
  the source case number. Only on confirm does `onFill` + `accept` fire.
- `borrowers/hooks/use-draft-returning-autofill.ts` + `cases/components/draft-borrower-card.tsx`: carry
  `source_borrower_id` + copy flags into draft state alongside the 17 personal fields.
- Imported financials land **after save** (server-side, via the extended `create_case_draft`). On the live
  case the imported incomes/obligations should carry a **"verify" affordance** (reuse the amber pattern /
  a one-time banner) — advisor must re-confirm.

## Phase 4 — QA / rollout
- **Staging first:** apply the migration to the Vultr DB (node+pg, atomic), deploy via `deploy.sh`
  (`SKIP_MIGRATIONS=1`), full regression.
- **Regression matrix:** new case (returning + fresh), lead convert (rich + simple), import-cases,
  bank PDF, DTI/simulator, and verify the staging split (2 borrowers) row-by-row.
- **Then prod:** apply the atomic migration (incl. the 4-borrower split) to Kaufman prod, verify the
  4 splits + counts by hand, deploy the code. Tell the user to reload any open borrower forms (the
  optimistic-lock `version` resets on the split copies).

## Risks (now low at this scale, but handle)
- Split atomicity → single transaction + row-count asserts + ROLLBACK on mismatch.
- Child-row cloning completeness (incomes/obligations/documents) → assert counts pre/post.
- Open forms get 40001 after `version` reset → reload after migration (only affects the 4 split borrowers).
- `import_cases` re-import now creates duplicate borrowers → **document the new import contract**.
- Backup cross-version: a copy-model backup can't restore onto a shared-identity schema (unique index) →
  add a comment to the restore RPC.

## Open decisions
1. **Default copy flags:** detection is opt-in (advisor clicks Import). Default the panel to **profile only**,
   advisor ticks incomes/obligations (matches "old case → don't bring income; parallel mortgage → bring it").
2. **import_cases contract:** OK that re-importing an existing client now creates a duplicate borrower row?
3. **Legacy `save_borrower_for_case` (mig 064):** fix in place or `REVOKE EXECUTE`? (It's an open IDOR today.)

## Out of scope
- No `case_id` column on financials (not needed — copy gives isolation).
- No analytics/RLS/backup-allowlist changes (verified unaffected).
