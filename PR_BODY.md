## Summary
Comprehensive fixes from the second deep-review pass. Three categories:
- 🔴 **Security** (race conditions, scope validation, defense-in-depth, sanitization, length cap)
- 🟡 **Stability** (memory leaks, Drive pagination, partial-failure guards, metadata merge)
- 🟢 **UX & CLAUDE.md compliance** (AlertDialog, BackArrow, logical RTL props, toasts, file size limits)

## What's in

### Critical security
- **OAuth token-refresh race**: `GoogleDriveClient.getAccessToken()` now serializes via an in-flight promise — concurrent Drive calls no longer race to overwrite each other's persisted token.
- **OAuth scope validation**: callback rejects connections that lack the full `drive` scope (Google's consent screen lets users partially grant; previously we stored a useless "connected" row).
- **Defense-in-depth on actions**: every server action that takes a `caseId` now verifies the caller can read the case before mutating (`quick-update-case`, `delete-case` × 3, `save-borrower`, `set-primary-bank`, `delete-document`).
- **Document-action case scoping**: `update-document-status`, `assign-document-category`, `delete-document` now `.eq('case_id', caseId)` on the doc selector so caller-supplied IDs must match.
- **XSS render-side**: `request_details` is re-sanitized when displayed (not just on write), guarding against any bypass — studio writes, audit replays, future import scripts.
- **Length cap**: `request_details` capped at 50,000 chars in the Zod schema (HTML DoS vector closed).

### Algorithmic stability
- **Atomic primary-bank swap**: new RPC `set_primary_bank` (migration 021) replaces two separate UPDATE/INSERT calls. No more "no primary mid-flight" window or silent half-completion.
- **Drive pagination**: new `listFolderFilesPaginated` follows `nextPageToken`. The unpaginated 200-cap would have soft-deleted everything beyond the first page on next sync.
- **Partial-failure guard**: Drive sync's deletion sweep is skipped if any subfolder list call failed — a single 403/quota no longer wipes that folder's records.
- **Metadata merge**: drive-document-sync now merges the existing JSONB instead of replacing it. The replace was wiping `storage_path` on app-uploaded docs that later got moved in Drive.
- **Memory leaks**: resize listeners in `editable-status-cell` and `editable-advisor-cell` are now removed in the cleanup (previously each open leaked one listener — 80-row dashboard scaled this badly).
- **Save-borrower**: surfaces the `cases.primary_borrower_id` update error instead of swallowing it.
- **listBorrowersForCase**: filters out join rows whose borrower is soft-deleted.
- **Type safety**: removed the single `as any` cast in `quick-update-case` via `satisfies` + generated `CasesUpdate` type.

### UX & CLAUDE.md
- **AlertDialog primitive**: new `components/ui/alert-dialog.tsx` replaces the two `window.confirm()` calls (document delete, Drive disconnect). RTL-clean, brand-styled, non-blocking.
- **Save-on-blur toast**: editable-text-cell pops a sonner error when the inline save fails (was silently reverting).
- **BackArrow component**: direction-aware back arrow (`/cases/new` page, both action bars). Hebrew → `ArrowRight`, English → `ArrowLeft`.
- **Logical properties**: `text-right` → `text-start` in five components; sidebar badge `left-1.5` → `end-1.5`; dropdown chevron `ml-auto` → `ms-auto rtl:rotate-180`.
- **Result<T,E>**: actions in `delete-case.ts` and the new `remove-borrower.ts` now return Result instead of throwing.
- **File size limits**: `save-borrower.ts` split (form-data helpers → `lib/utils/form-data.ts`; remove-borrower extracted); `sanitize-html.ts` split (allowed-tags → `lib/constants/sanitize.ts`).
- **i18n keys added**: `common.saveFailed`, `documents.errors.drive_scope_missing`.

## What's intentionally skipped
- Audit log on OAuth connect/disconnect — Phase 2.
- Cross-locale fallbacks for lookup tables (`name_he` only) — separate refactor; spans many files.
- Wider Zod-on-read of Supabase results — high boilerplate cost vs. real-world risk.
- `dropdown-menu.tsx` line count — accepted as a shadcn wrapper exception.

## Test plan
- [ ] Documents page: upload, sync, delete (uses new AlertDialog), move file in Drive between folders, move file from a subfolder to case root → uncategorized section.
- [ ] Drive disconnect from Settings → Integrations → confirm dialog → row clears.
- [ ] Inline edit short_note → save on outside-click works; on simulated failure (DB down) the value reverts AND a toast appears.
- [ ] Dashboard dropdowns (status, bank, advisor) — resize the window with one open; reopen 20× → no listener growth in DevTools Memory.
- [ ] OAuth: partial consent (uncheck Drive on Google's screen) → returns to /settings/integrations with `drive_scope_missing` error displayed.
- [ ] Rich text editor: paste a 60kB chunk → save returns validation error instead of crashing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
