# Production Review Plan - 20 Coordinated Read-Only Rounds

## Purpose

This plan divides the complete `first-crm` repository into twenty coordinated
review rounds. The smaller scopes allow each reviewer to read its owned code
deeply while preserving end-to-end understanding across rounds.

Every file has one primary owner round. Critical workflows also have a later
verification round so that important behavior is reviewed from more than one
direction.

This plan organizes a review. It does not claim that any code has passed review.

## Read-Only Authority Boundary

All twenty rounds run in **READ-ONLY mode by default**.

Without explicit, item-specific user approval, a reviewer must not:

- Modify, create, delete, move, rename, or format any file.
- Fix code or documentation.
- Update the master ledger or create a handoff file.
- Add, remove, or update tests.
- Apply migrations, mutate databases, call production write endpoints, deploy,
  install dependencies, or change external systems.
- Perform Git write operations.
- Run commands that may write caches, generated artifacts, snapshots, data, or
  configuration.

When uncertain whether an action can write, stop and request permission.
Proposed ledger updates, handoffs, fixes, tests, and commands are returned in
the response only.

## Mandatory Reading Order

Every round reads:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/REVIEW_PLAN_20_ROUNDS.md`
4. `docs/review/MASTER_LEDGER.md`
5. `docs/review/ROUND_HANDOFF_TEMPLATE.md`
6. Every authorized `docs/review/ROUND-XX-HANDOFF.md` that exists
7. Relevant Next.js 16 documentation under `node_modules/next/dist/docs/`

Existing reviews such as `RELEASE_REVIEW.md` and `docs/UI_UX_REVIEW.md` are
leads, not proof. Reproduce findings before accepting them.

## Rules That Prevent Gaps

1. Every file has exactly one primary owner round.
2. Every critical workflow has at least one later verifier.
3. Every cross-round issue has exactly one proposed owner round.
4. No issue may be silently deferred.
5. Each reviewer returns a complete proposed handoff in its response.
6. Critical and High findings require a different verification round.
7. Run `node scripts/check-review-coverage.mjs` before and after every round.
8. Only Round 20 may propose a release decision.

## Continuity Without Unauthorized Changes

At the end of each round:

1. The reviewer returns proposed ledger rows and proposed handoff text in its
   response only.
2. The user reviews the proposal.
3. To preserve continuity, the user may explicitly authorize a
   documentation-only coordinator to write only:
   - `docs/review/MASTER_LEDGER.md`
   - `docs/review/ROUND-XX-HANDOFF.md`
4. That authorization does not permit code, test, configuration, migration, or
   other documentation changes.
5. If the user does not authorize persistence, the complete proposed handoff
   must be included in the next reviewer's prompt.

## Three Deliveries Per Round

### Delivery A - Understand and Review

- Read every owned file, related tests, routes, callers, and dependencies.
- Map inputs, outputs, permissions, data ownership, and failure modes.
- Compare behavior with product rules and repository standards.

### Delivery B - Safe Adversarial Verification

- Analyze invalid, malicious, stale, partial, concurrent, and unauthorized
  scenarios.
- Trace important paths across routes, actions, services, RPCs, tables, storage,
  cron jobs, and external integrations.
- Use static inspection and demonstrably read-only verification only.
- Distinguish suspected findings from verified findings.

### Delivery C - Recommendations, Regression Planning, and Handoff

- Do not fix or change anything.
- Propose a focused fix and affected files for every verified finding.
- Propose regression tests and safe verification commands.
- Return proposed ledger rows and a complete proposed handoff in the response.
- Stop and wait for explicit approval.

## Twenty Rounds

### Round 1 - Platform Runtime, Authentication, and Security Foundations

**Primary scope**

- `src/lib/**`
- `src/features/auth/**`
- `src/proxy.ts`
- Instrumentation files
- Root app layouts/errors/pages and authentication routes

**Review focus**

- Authentication, sessions, redirects, passwords, authorization helpers
- Environment validation, secrets, crypto, rate limiting, logging, Sentry
- Supabase clients, request context, HTTP helpers, shared validation
- Next.js runtime boundaries and server/client trust boundaries

**Later verification:** Rounds 17-19 verify database authorization; Round 20
verifies authentication workflows end to end.

### Round 2 - Shared UI, Design System, App Shell, PWA, and i18n Catalogs

**Primary scope**

- `src/components/**`
- `src/features/pwa/**`
- `src/i18n/**`
- `messages/**`
- `public/**`
- `src/app/globals.css`
- Protected app shell layouts, loading, error, and not-found states
- `docs/mockups/**`

**Review focus**

- Shared component correctness and accessibility
- RTL/LTR, translations, terminology, responsive behavior, keyboard/focus
- App shell navigation, global states, installability, and PWA behavior
- Missing or inconsistent translation keys and unsafe translated content

**Later verification:** Every product round validates shared primitives in
context; Round 20 performs full accessibility and localization reconciliation.

### Round 3 - Administration, Team, Settings, Audit, and Import

**Primary scope**

- `src/features/settings/**`
- `src/features/team/**`
- `src/features/audit/**`
- `src/features/import/**`
- Administration, settings, team, and audit routes

**Review focus**

- Admin-only actions, role changes, invites, profile and office settings
- Audit fidelity, PII handling, imports, atomicity, and error reporting
- Permission editors, self-protection, destructive actions, and recovery

**Later verification:** Rounds 17-19 verify grants/RLS/RPCs; Round 20 verifies
admin and import workflows.

### Round 4 - Leads, Public Intake, Landing Site, Consent, and Legal Surface

**Primary scope**

- `src/features/leads/**`
- `src/features/intake/**`
- Public intake route
- `landing/**`
- `docs/legal/**`

**Review focus**

- Landing-to-intake-to-lead data flow
- Spam, replay, validation, consent, privacy, and legal consistency
- Lead lifecycle, conversion readiness, deletion, and notification handoff
- Public endpoint abuse, failure states, mobile, RTL, and accessibility

**Later verification:** Round 5 verifies conversion into cases; Round 19 verifies
final public-intake database controls; Round 20 verifies the complete flow.

### Round 5 - Case Lifecycle Core, Dashboard, Lists, and Case Services

**Primary scope**

- `src/features/cases/actions/**`
- `src/features/cases/domain/**`
- `src/features/cases/hooks/**`
- `src/features/cases/schemas/**`
- `src/features/cases/services/**`, except `services/export/**`
- `src/features/cases/types.ts`
- Dashboard, case list, new/edit case, and recycle-bin routes

**Review focus**

- Lead conversion, draft creation, updates, statuses, advisors, fees, properties
- List filters, sorting, visibility, realtime refresh contracts, soft deletion
- Transaction boundaries, optimistic locking, idempotency, and error mapping

**Later verification:** Rounds 6, 8-10, and 14 verify consumers; Rounds 17-19
verify database behavior; Round 20 verifies lifecycle workflows.

### Round 6 - Case Workspace UI and Case-Level Orchestration

**Primary scope**

- `src/features/cases/components/**`
- Main case-detail route and loading state

**Review focus**

- Workspace composition, inline editing, block preferences, action controls
- Correct-case isolation and role-specific field visibility
- Loading, empty, error, mobile, RTL, and destructive-action states
- Cross-feature contracts with borrowers, financials, tasks, comments, and docs

**Later verification:** Rounds 8-14 verify embedded domains; Round 20 verifies
the workspace end to end.

### Round 7 - Case PDFs, Reports, and Exports

**Primary scope**

- `src/features/cases/pdf/**`
- `src/features/cases/services/export/**`
- Case export API route

**Review focus**

- PDF/XLSX correctness, field-level authorization, deleted data, formula injection
- PII exposure, formatting, Hebrew/English output, large datasets, failure modes
- Consistency between exported values, case UI, and source records

**Later verification:** Rounds 8-9 verify financial inputs; Round 20 verifies
rendered output and export behavior.

### Round 8 - Borrowers, Identity, and Income

**Primary scope**

- `src/features/borrowers/**`
- `src/features/incomes/**`
- Borrower create/edit routes

**Review focus**

- Returning borrowers, national IDs, identity matching, cross-case isolation
- Income totals, dates, schemas, optimistic locking, and soft deletion
- Multi-borrower behavior and consistency with case/simulator data

**Later verification:** Rounds 15-16 verify simulator consumption; Rounds 17-19
verify database controls.

### Round 9 - Obligations, Case Banks, and Case Expenses

**Primary scope**

- `src/features/obligations/**`
- `src/features/case-banks/**`
- `src/features/case-expenses/**`
- Bank create/edit routes

**Review focus**

- Debt totals, primary-bank rules, expenses, receipts, and soft deletion
- Multi-bank and multi-obligation edge cases
- Cross-case isolation, calculations, concurrent edits, and storage contracts

**Later verification:** Round 10 verifies receipt/document lifecycle; Rounds
15-16 verify simulator inputs; Rounds 17-19 verify database controls.

### Round 10 - Documents, Uploads, Storage, Retention, and Erasure

**Primary scope**

- `src/features/documents/**`
- Document routes
- Orphan-cleanup and erasure-watchdog API routes
- `dev-fixtures/**`

**Review focus**

- Signed upload/finalize, MIME and size validation, preview, deletion, checklist
- Storage isolation, tombstones, retention, erasure, and partial failure
- Unauthorized access, malicious files, race conditions, and orphan cleanup

**Later verification:** Round 11 verifies Drive behavior; Round 19 verifies
storage/RLS/erasure; Round 20 verifies recovery and operations.

### Round 11 - Google Drive, Integrations, Backup, and Restore

**Primary scope**

- `src/features/integrations/**`
- `src/features/backup/**`
- Google OAuth routes
- Backup and backup-watchdog API routes
- Related settings routes

**Review focus**

- OAuth state, token encryption, Drive sync/dedup, partial failure, reconciliation
- Backup completeness, encryption, freshness, restore behavior, and recovery
- Admin gating, secret rotation, retries, observability, and operational safety

**Later verification:** Round 19 verifies restore/security RPCs; Round 20 verifies
deployment, cron, backup, and recovery evidence.

### Round 12 - Templates, Email, Notifications, Push, and SLA

**Primary scope**

- `src/features/templates/**`
- `src/features/notifications/**`
- `src/features/sla/**`
- Template and notification settings/routes
- Push-dispatch and status-SLA cron routes

**Review focus**

- Template sanitization, email content, recipient correctness, PII leakage
- Notification preferences, push subscriptions, duplicate/missing delivery
- SLA calculations, cron idempotency, retries, and failure visibility

**Later verification:** Round 13 verifies task-generated notifications; Round 19
verifies database controls; Round 20 verifies delivery and cron operations.

### Round 13 - Tasks, Assignment, Threads, Attachments, and Reminders

**Primary scope**

- `src/features/tasks/**`
- Tasks route
- Task-reminder cron route

**Review focus**

- Task CRUD, assignment/reassignment, attribution, comments, mentions, attachments
- Case isolation, permissions, due dates, snooze/reminders, concurrency
- Notification contracts, file contracts, realtime behavior, and cron idempotency

**Later verification:** Rounds 10, 12, and 14 verify dependencies; Round 19
verifies RLS/RPCs; Round 20 verifies complete workflows.

### Round 14 - Case Collaboration, Activity Timeline, and Statistics

**Primary scope**

- `src/features/case-comments/**`
- `src/features/case-activity/**`
- `src/features/statistics/**`
- History and statistics routes

**Review focus**

- Comments, mentions, email activity, audit parsing, timeline ordering
- Authorization, PII visibility, deletion, realtime, and missing events
- Statistics correctness, date ranges, stage durations, and source consistency

**Later verification:** Round 19 verifies comments/statistics RPCs and RLS;
Round 20 verifies timeline and dashboard behavior.

### Round 15 - Simulator Calculation Engine and Persistence Contracts

**Primary scope**

- `src/features/simulators/domain/**`
- Simulator actions, schemas, services, types, constants, utilities, and tests

**Review focus**

- Mortgage, LTV, DTI, tax, amortization, CPI, stress, risk, and rounding rules
- Boundary inputs, authoritative examples, deterministic calculations
- Scenario persistence, case isolation, concurrency, and validation contracts

**Later verification:** Round 16 verifies UI/report consumers; Rounds 18-19
verify simulator database structures; Round 20 verifies complete workflows.

### Round 16 - Simulator UI, Comparison, Reports, and Settings

**Primary scope**

- `src/features/simulators/components/**`
- `src/features/simulators/hooks/**`
- `src/features/simulators/pdf/**`
- All simulator routes and simulator settings route

**Review focus**

- Input UX, comparisons, reports, saved scenarios, loading/error behavior
- Correct use of Round 15 calculations and persistence contracts
- Mobile, RTL/LTR, accessibility, PDFs, and malformed/stale scenario behavior

**Later verification:** Round 19 verifies final scenario permissions; Round 20
verifies rendered flows.

### Round 17 - Database Foundation and Migrations 001-055

**Primary scope**

- `supabase/migrations/001_*` through `055_*`

**Review focus**

- Foundation schema, auth, roles, permissions, core entities, RLS, audit
- Storage foundations, integrations, notifications, constraints, and indexes
- Security-definer functions, grants, triggers, search paths, and transactions

**Critical rule:** Check later migrations before claiming that an old migration
issue remains live. Return every assumption requiring verification in Rounds
18-19.

### Round 18 - Database Hardening and Migrations 056-110

**Primary scope**

- `supabase/migrations/056_*` through `110_*`

**Review focus**

- Optimistic locking, cleanup, restore, audit hardening, borrower writes
- Draft/lifecycle RPCs, SLA, expenses, tasks, scenarios, checklists, comments
- Storage and deletion behavior, permissions, indexes, and migration safety

**Required reconciliation:** Validate Round 17 assumptions and hand remaining
effective-state questions to Round 19.

### Round 19 - Final Database State, Migrations 111-Latest, RLS, and SQL Tests

**Primary scope**

- `supabase/migrations/111_*` through latest
- `supabase/tests/**`
- `supabase/seeds/**`
- `supabase/config.toml`
- `src/types/database.ts`
- Root intake migration bundle, if present

**Review focus**

- Final effective schema, grants, RLS, storage policies, functions, and triggers
- Tasks/comments/attachments, advisors, statistics, retention/erasure, intake
- Migration ordering, reproducibility, generated-type drift, and SQL test gaps
- Final resource/role permission matrix for all product rounds

**Later verification:** Round 20 reconciles database evidence with complete
product workflows and release operations.

### Round 20 - Release Engineering, Operations, Supply Chain, and Full Integration

**Primary scope**

- `.github/**`
- `scripts/**`
- `docs/**`, except scopes assigned earlier
- Root configuration, package, lockfile, deployment, and release files
- Health API route

**Cross-review scope**

- Every critical workflow and unresolved contract from Rounds 1-19
- UI/UX, accessibility, mobile, RTL/LTR, privacy, observability, and recovery
- CI, dependencies, deploy, migrations-before-code, health, cron, backup,
  rollback, incident response, and production operator readiness

**Release gate**

- Reconcile authorized ledger/handoffs and proposed updates.
- Verify zero unassigned files.
- Identify missing evidence and tests requiring approval.
- Propose `GO`, `CONDITIONAL GO`, or `NO-GO` with evidence.

## Critical Workflow Ownership

| Workflow | Primary round | Later verifier |
| --- | ---: | ---: |
| Login, reset, invite, session revocation | 1 | 19 and 20 |
| Shared UI, RTL/LTR, accessibility | 2 | Product rounds and 20 |
| Roles, settings, team administration | 3 | 19 and 20 |
| Landing, public intake, consent, lead | 4 | 5, 19, and 20 |
| Case lifecycle and visibility | 5 | 19 and 20 |
| Case workspace orchestration | 6 | 8-14 and 20 |
| PDF/XLSX exports | 7 | 20 |
| Borrower identity and income | 8 | 15, 19, and 20 |
| Banks, obligations, and expenses | 9 | 15, 19, and 20 |
| Upload, storage, retention, erasure | 10 | 11, 19, and 20 |
| Drive, backup, restore | 11 | 19 and 20 |
| Email, templates, notifications, SLA | 12 | 13, 19, and 20 |
| Tasks, reminders, attachments | 13 | 19 and 20 |
| Collaboration, activity, statistics | 14 | 19 and 20 |
| Simulator calculations and persistence | 15 | 16, 19, and 20 |
| Simulator UI and reports | 16 | 20 |
| Foundation database security | 17 | 18-20 |
| Database hardening | 18 | 19-20 |
| Final RLS, RPC, and schema state | 19 | 20 |
| Deploy, monitoring, recovery, release | 20 | Release owner |

## Required Finding Format

Every proposed finding contains:

| Field | Required value |
| --- | --- |
| ID | `R{round}-{domain}-{number}` |
| Severity | Blocker / Critical / High / Medium / Low |
| Status | Suspected / Verified / Fix Proposed / Fixed / Accepted Risk |
| Confidence | High / Medium / Low |
| Owner round | Exactly one round |
| Verification round | Different round for Critical/High |
| Files and lines | Exact references |
| Evidence | Read-only reproduction, trace, query, or static proof |
| Impact | Product, security, privacy, data, reliability, performance, or UX |
| Proposed fix | Recommended change and affected files |
| Proposed regression | Test/command and expected result |
| Dependencies | Finding IDs or cross-round contracts |

## Proposed Handoff Requirement

Each round returns proposed content matching
`docs/review/ROUND_HANDOFF_TEMPLATE.md`. It does not write the handoff.

The proposal must include:

1. Scope promised and actually reviewed
2. Files, routes, flows, resources, and roles reviewed
3. Findings and evidence
4. Proposed fixes and regressions
5. Read-only commands run
6. Commands/tests requiring approval
7. Confirmed and open cross-round contracts
8. Residual risks
9. Exact starting instructions for the next round

## Reusable Read-Only Prompt

Use `docs/review/READ_ONLY_AGENT_PROMPT_HE.md` and replace `{מספר הסבב}` with a
number from 1 through 20.
