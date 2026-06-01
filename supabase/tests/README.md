# Database tests (RLS / pgTAP) — QA-1

Permission + RLS isolation tests: the security boundary the product rests on
(advisors isolated per-case, manager-only financials hidden, leads IDOR closed).
These run **against a real Postgres** because RLS can only be tested with a real
`auth.uid()` per user — the SQL Editor / service-role bypass RLS.

## Run locally (needs Docker)

```bash
supabase start        # boots Postgres + applies ALL migrations to a fresh DB
supabase test db      # runs every supabase/tests/*.sql via pgTAP
supabase stop
```

## Coverage — `rls_permissions_test.sql`

- **Per-advisor case isolation** — advisor A cannot see advisor B's case (and vice
  versa); manager + secretary (view_all_cases) see both.
- **Manager-only financials** — advisors and secretary cannot read
  `case_financials`; only the manager can (`view_case_fee`).
- **Leads** — owner-scoped reads, and the **IDOR write fix (migration 116)**:
  advisor B's UPDATE of advisor A's lead changes nothing.

Advisor A/B are seeded as `junior_advisor` (which has only `view_own_*`, no
`view_all`) — that's what makes them isolated.

## CI

`.github/workflows/db-tests.yml` runs this on PRs that touch `supabase/**`.

## Extending

Add to the matrix with the `pg_temp.login_as(<uuid>)` + `is(...)` pattern.
Good next cases: child tables (borrowers / incomes / documents) per-case scope,
`convert_lead_to_case` ownership, the export route, and per-user permission
overrides.

## If a run goes red, check first

- `auth.users` column set (the `mk_user` helper's insert) for this Supabase version.
- The `handle_new_user` signup-hardening trigger (migration 059) — `mk_user`
  sets `invited_by` so it doesn't refuse.
- pgTAP availability (`CREATE EXTENSION pgtap`) in the DB image.
- A clean `supabase db reset` (the duplicate migration 103 was renamed to 118 so
  the apply records each version once).
