# Deploy handoff — first-crm

**From:** a cloud Claude Code session (no server access, no Docker, no SSH).
**To:** a local/server session that can reach the Vultr host.
**Date:** 2026-08-20
**Branch to deploy:** `claude/crm-system-market-pricing-c6od4l`
**Head commit:** `f51b230`

---

## 1. What is being deployed

Three commits on top of `0127a60`. All are small, self-contained, and verified.

### `6231992` — fix(security): gate manager-only audit history internally, cap public free text

Two hardening fixes found while mapping the codebase for a future assistant layer.

**(a) `listAuditEntriesForCase` no longer trusts the caller for financials.**

It reads via the **service-role** client (bypasses RLS) and used to take
`includeFinancials` as a caller-supplied boolean. The one real caller —
`src/app/(app)/cases/[id]/history/page.tsx` — passed
`userHasPermission('view_case_fee')` correctly, **so nothing was leaking in
production**. The problem was the shape: any new call site (a report, an
export, an assistant tool) that copied it without the check would surface
`fee_amount` / `expected_income` history to any case viewer.

The permission is now resolved **inside** the service off the current user and
is no longer delegable. `userHasPermission` is React `cache()`-deduped, so the
extra call costs nothing within a request.

Signature changes (both are narrowing — no caller gains anything):

```
listAuditEntriesForCase(caseId, limit, opts)  ->  listAuditEntriesForCase(caseId, limit)
listCaseActivity(caseId, opts)                ->  listCaseActivity(caseId)
```

Files: `src/features/audit/services/audit.service.ts`,
`src/features/case-activity/services/case-activity.service.ts`,
`src/app/(app)/cases/[id]/history/page.tsx`

**(b) Public intake free-text cap lowered.**

The `/check` questionnaire accepted `request_details` up to
`REQUEST_DETAILS_MAX` (50,000 chars) on an **unauthenticated** write path.
Staff pasting a long history into a case legitimately need that; an anonymous
prospect never does. Public intake now uses a new
`PUBLIC_REQUEST_DETAILS_MAX = 4_000`, matching the contact form's existing cap.
Internal case forms are unchanged at 50k.

Files: `src/lib/validators/form-primitives.ts`,
`src/features/intake/schemas/intake.schema.ts`

> Note: `src/app/api/web-lead/route.ts` itself was already well defended
> (16KB body cap, Origin check, honeypot, timing trap, fail-closed rate limit).
> The gap was in the schema, not the route. No route change was needed.

### `8307027` — docs(claude): correct two load-bearing inaccuracies

`CLAUDE.md` claimed **TanStack Query 5** as the server-state layer. It is not a
dependency and never has been — verified against `package.json`. Corrected to
describe what actually happens: Server Components fetch through feature
`services/`, mutations invalidate via `revalidatePath`/`revalidateTag` or
`router.refresh()`.

The project-structure diagram also placed `messages/` inside `src/`; it lives at
the repo root.

**No code change.** Docs only — but both errors would steer any developer or
agent into writing wrong code.

### `f51b230` — chore(scripts): rename audit-pdf-rtl to .cjs so lint passes

`npm run lint` was **already failing on `main`** with 4 errors:
`scripts/audit-pdf-rtl.js` uses `require()`, and `eslint.config.mjs` only
exempts `scripts/**/*.cjs`. The file is a standalone CommonJS node tool, same as
the existing `apply-migration.cjs` — the extension was simply wrong rather than
the rule. Renamed; one doc-comment reference in
`src/features/cases/pdf/shared.test.ts` updated.

This matters for you: `.github/workflows/ci.yml` runs `npm run lint` on every PR
and on push to `main`. It was red for anything gated on CI. It is green now.

---

## 2. Verification already done (in the cloud session)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (vitest) | **545 passed / 545**, 87 files |
| `npm run lint` | **clean** (was 4 errors before `f51b230`) |
| `npm run build` (production, placeholder env) | **succeeded** — compiled in 30.7s, TypeScript 29.2s, all routes generated |

No migrations were added. `supabase/migrations/` is untouched — the schema is
unchanged, so `supabase db push` will be a no-op.

---

## 3. How to deploy

The deploy target is the **Docker demo on the shared Vultr host**, not Vercel.
`scripts/deploy.sh` is the single source of truth and must be run **on the
server**. Do not invent an ad-hoc flow — that script exists precisely because
different sessions kept doing that.

### The important decision: which branch

`deploy.sh` deploys `main` by default. The fixes are on
`claude/crm-system-market-pricing-c6od4l`. Two options:

**Option A — merge to `main` first (recommended).** Normal flow, and CI is green
now so a PR will pass.

```bash
# from a checkout, or via the GitHub UI
git checkout main
git pull origin main
git merge --no-ff claude/crm-system-market-pricing-c6od4l
git push origin main
```

Then on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/Shmuel18/first-crm/main/scripts/deploy.sh \
  -o /opt/deploy-first-crm.sh
bash /opt/deploy-first-crm.sh
```

**Option B — deploy the branch directly** (to see it live before merging):

```bash
DEPLOY_BRANCH=claude/crm-system-market-pricing-c6od4l bash /opt/deploy-first-crm.sh
```

> Ask Shmuel which one he wants. The cloud session was instructed never to push
> to a branch other than its own, so `main` was deliberately left untouched.

### What the script does (all 9 steps reversible until the swap)

1. Fresh shallow clone of the branch to `/opt/first-crm_new`
2. **Copies** the existing `.env.production` — never regenerates secrets
3. Tags the running image as `first-crm:prev` (rollback point)
4. `docker build` with the env file as a BuildKit secret
5. Smoke-tests the new image on throwaway port **3798** before touching prod
6. `supabase db push` **before** the swap (no-op here — no new migrations)
7. Swaps the container on port **3747**
8. Health check on `/api/health` (real DB round-trip), **auto-rollback** on failure
9. Rotates dirs: `first-crm` → `first-crm_prev`, `first-crm_new` → `first-crm`

---

## 4. Gotchas hit during verification

- **`INTEGRATION_ENCRYPTION_KEY` and `BACKUP_ENCRYPTION_KEY` must be different
  values.** The env schema rejects identical keys and the build dies at
  "Collecting page data" with a confusing `Failed to collect page data for
  /api/auth/google/start`. If you see that error, check these two first.
- **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must base64-decode to a 16/24/32-byte
  AES key.** Generate with `openssl rand -base64 32`.
- `deploy.sh` aborts early with a clear message if any required key is missing
  from `/opt/first-crm/.env.production`. Trust that check — do not add
  placeholder values to get past it.
- The script needs the **Supabase CLI** on the host for step 6. If it is absent
  the deploy aborts. Since this change has **no migrations**, `SKIP_MIGRATIONS=1`
  is a legitimate shortcut here if the CLI is not installed yet.

---

## 5. Do NOT do

- **Do not enable `.github/workflows/deploy.yml`.** It is intentionally disabled
  (`on: workflow_dispatch`) — its header says there is no prod Supabase/Vercel
  project yet, and its 28 historical runs (all 2026-05-26) all failed at
  `supabase link`. That is a separate future project, not part of this deploy.
- **Do not regenerate any secret** in `.env.production`. Rotating
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` invalidates in-flight server-action IDs
  in open browser tabs.
- **Do not force-push or rewrite** `claude/crm-system-market-pricing-c6od4l`.

---

## 6. Post-deploy check

```bash
curl -s http://localhost:3747/api/health
# expect: {"ok":true, ...}
```

Then verify the one behavioural change that is user-visible:

1. Open any case → **History / היסטוריה** tab **as a manager** → fee and
   expected-income changes still appear in the timeline.
2. Same tab **as a non-manager advisor** (no `view_case_fee`) → those entries
   must be **absent**. This was already the behaviour; the fix makes it
   structural rather than caller-dependent, so it is a regression check, not a
   new feature.
3. Submit the public `/check` questionnaire with a long free-text answer —
   anything over 4,000 chars should now be rejected with a translated
   validation error rather than accepted.
