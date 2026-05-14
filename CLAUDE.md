# Kaufman Finance Group SaaS

> **Important:** Spec lives in `C:\Users\shh92\Documents\Kaufman-Finance-Spec\Kaufman-Finance-Spec.md`.
> Read it before making feature decisions. Mockups in same folder under `mockups/`.

## Project Context
A SaaS for **Kaufman Finance Group** - an Israeli mortgage advisor office. Replaces Excel + CRM + Drive + WhatsApp with a unified platform.

- ~80 active mortgage cases at any time
- Manager (Kaufman) + multiple advisors + optional secretary
- **Bilingual:** Hebrew (RTL primary) + English (LTR)
- **Mobile-first** responsive design
- Premium brand feel: black + gold + white
- Built with Claude/Codex (AI-driven development)
- Timeline: ~1 month to MVP

## Tech Stack
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Database:** Supabase (PostgreSQL) + Supabase Auth
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Icons:** Lucide React (NEVER emojis in UI)
- **Forms:** React Hook Form + Zod validation
- **i18n:** next-intl
- **Server state:** TanStack Query
- **URL state:** nuqs (type-safe URL search params)
- **Animations:** Framer Motion (subtle, professional)
- **Env vars:** @t3-oss/env-nextjs (type-safe)
- **Hosting:** Vercel

## Brand
| Element | Value |
|---|---|
| Black | `#0A0A0A` |
| Gold | `#C9A961` |
| White | `#FFFFFF` |
| Surface gray | `#FAFAFA` |
| Border | `#E5E5E5` |
| Body font (Hebrew) | Heebo / Assistant |
| Body font (English) | Inter |
| Heading font (Hebrew) | Frank Ruhl Libre |
| Heading font (English) | Playfair Display |

## Architecture - Layer Responsibilities

Every file lives in exactly one layer. Crossing layers requires going UP through a port (hook/action), never sideways or down.

```
┌─────────────────────────────────────────────────┐
│  UI Layer            → rendering only           │
│  (components/)         no logic, no fetching    │
├─────────────────────────────────────────────────┤
│  Application Layer   → orchestration            │
│  (hooks/, actions/)    glues UI to domain/infra │
├─────────────────────────────────────────────────┤
│  Domain Layer        → pure business logic      │
│  (domain/)             LTV, debt ratio, status  │
│                        transitions, validations │
├─────────────────────────────────────────────────┤
│  Infrastructure      → DB, APIs, external       │
│  (lib/supabase/,       Supabase, Drive, etc.    │
│   services/)                                    │
└─────────────────────────────────────────────────┘
```

**Rules:**
- UI imports from Application (hooks/actions) - never directly from Infrastructure
- Domain is **pure** - no imports from Application, UI, or Infrastructure
- Infrastructure imports only Domain types (never Application or UI)
- Layer violations = automatic code review reject

## Engineering Standards (Non-Negotiable)

### File Size Limits
- Components: max **250 lines**
- Hooks: max **150 lines**
- Server Actions: max **100 lines**
- Utility functions: max **30 lines**
→ Exceeding limit means SPLIT, not deferred

### TypeScript
- `strict: true` + `noUncheckedIndexedAccess: true`
- NO `any` - use `unknown` and narrow with type guards
- NO `as` casting except justified edge cases (require comment)
- Use **branded types** for entity IDs: `type CaseId = string & { __brand: 'CaseId' }`
- Discriminated unions for state (not optional flags)

### Component Architecture - "Dumb Components"
- **Server Components by default**
- `'use client'` only for: interactivity, state, browser APIs
- One component = one responsibility
- Co-locate components within their feature folder (NOT in shared `/components`)
- Container/Presentation split when logic is non-trivial

**Components MUST be dumb:**
- NO business logic in components (move to `domain/` or `hooks/`)
- NO calculations inside components (compute in `domain/` or via hook)
- **NO direct data fetching in Client Components.** Server Components MAY fetch data, but only through feature-level `services/` or `actions/` (never raw Supabase calls inside the JSX file)
- Components receive data via props/hooks ONLY
- Components only do: rendering + simple event delegation

### Data Flow
- Server state: TanStack Query
- Client state: useState/useReducer (minimal)
- Form state: React Hook Form + Zod
- URL state: **nuqs** (type-safe `useQueryState`) - critical for filters, sorting, pagination in tables
- NO global state libraries unless absolutely needed

### Validation
- Zod schemas are the **single source of truth**
- Types inferred from schemas via `z.infer<typeof Schema>`
- Validate on BOTH client AND server (same schema)

### Server Actions Rules
- One action = one responsibility (single verb in the name: `createCase`, `updateBorrower`, `deleteTask`)
- MUST validate input with Zod (`schema.safeParse`)
- MUST return typed `Result<T, E>` (success/error discriminated union)
- MUST check authentication/authorization at the top
- NO direct DB calls from components - components call the action
- NO multi-purpose actions ("updateOrCreateAndAlsoSend" is forbidden)
- File: max 100 lines (split sub-helpers into `domain/`)

### Performance
- Prefer Server Components to reduce client bundle size
- Avoid unnecessary re-renders (no inline objects/arrays in props when reused)
- Use `memo`/`useMemo`/`useCallback` ONLY when measured to help (not by default)
- Lazy load heavy components (`next/dynamic`) for routes that aren't the critical path
- Stream long pages (Suspense + loading.tsx) instead of blocking
- Use database indexes on all foreign keys + frequently-filtered columns

### Database
- All queries through Supabase typed client
- Use generated types in `src/types/database.ts`
- **RLS (Row Level Security)** on every table
- Migrations versioned in `/supabase/migrations`
- Soft deletes via `deleted_at` where appropriate

### Naming Conventions
**Rule:** files are kebab-case, exports inside are PascalCase (components/types) or camelCase (functions/hooks).

| Type | File name | Export name |
|---|---|---|
| Component | `case-row.tsx` | `CaseRow` (PascalCase) |
| Hook | `use-case.ts` | `useCase` (camelCase) |
| Utility fn | `format-date.ts` | `formatDate` (camelCase) |
| Server Action | `create-case.ts` | `createCase` (camelCase) |
| Schema | `case.schema.ts` | `CaseSchema` (PascalCase) |
| Type | (in `types.ts`) | `Case`, `CaseId` (PascalCase) |
| Constant | (in `constants.ts`) | `MAX_BORROWERS` (SCREAMING_SNAKE_CASE) |
| Folder | `features/cases/` | (kebab-case) |

### Imports Order
1. React/Next.js
2. External libraries (alphabetical)
3. Internal absolute imports (`@/...`)
4. Relative imports
5. Types (separately at bottom if many)

### Error Handling
- Use `Result<T, E>` pattern for fallible operations
- Throw only for programmer errors (unreachable code, invariants)
- User-facing errors MUST be translated (i18n)
- Log to console in dev; Sentry in production (Phase 2)

### Testing Philosophy (Phase 2)
- Test **business logic only** (the domain layer) - this is where regressions hurt
- Do NOT test UI implementation details (text, classes, exact DOM)
- Prefer **integration tests over unit tests** when feasible (closer to real behavior)
- E2E for critical flows only (login, create case, generate PDF) - Playwright
- A failing test must reproduce in one command

### Definition of Done
A feature is **NOT done** until ALL of these are true:
- [ ] TypeScript strict passes (no `any`, no missing return types)
- [ ] Zod schema exists and validates input
- [ ] Errors are handled with `Result<T, E>` or proper boundaries
- [ ] Code respects file size limits (split if needed)
- [ ] No duplicated schemas/types/logic
- [ ] User-facing strings go through i18n
- [ ] Component renders correctly on mobile (≤ 768px) AND desktop
- [ ] Works in both Hebrew (RTL) and English (LTR)
- [ ] Permissions checked at server boundary
- [ ] Code committed with conventional commit message

### Commits
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Commit early and often
- One logical change per commit

## Project Structure
```
src/
├── app/                           # Next.js App Router (routes only)
│   ├── (auth)/                    # Login, signup, password reset
│   ├── (app)/                     # Protected app routes
│   │   ├── dashboard/page.tsx
│   │   ├── cases/[id]/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx             # Sidebar + Topbar
│   ├── (public)/                  # Public-facing
│   │   └── check/page.tsx         # Onboarding form
│   └── api/                       # API routes (webhooks etc.)
│
├── features/                      # Most code lives here (feature-first)
│   ├── auth/
│   │   ├── components/
│   │   ├── actions/               # Server actions
│   │   ├── schemas/
│   │   ├── hooks/
│   │   ├── services/              # External integrations (optional - only if needed)
│   │   ├── domain/                # Pure business logic (computed values, rules)
│   │   ├── types.ts
│   │   └── index.ts               # Public API
│   ├── cases/
│   ├── borrowers/
│   ├── documents/                 # has services/google-drive.ts for OAuth + API calls
│   ├── tasks/
│   ├── permissions/
│   └── settings/
│
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── layout/                    # Sidebar, Topbar
│   └── shared/                    # Cross-feature shared
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser client
│   │   ├── server.ts              # Server client
│   │   └── middleware.ts          # Auth middleware
│   ├── i18n/
│   ├── utils/
│   └── env.ts                     # Type-safe env vars
│
├── types/
│   └── database.ts                # Auto-generated from Supabase
│
├── messages/                      # i18n translations
│   ├── he.json
│   └── en.json
│
└── middleware.ts                  # Auth middleware
```

## Domain Concepts
- **Case (תיק):** A mortgage case with status, borrowers, banks, documents
- **Borrower (לווה):** A person on a case (1-N borrowers per case)
- **Lead (ליד):** Pre-case status; created from phone or onboarding form
- **Status (שלב בתהליך):** 12 stages from "ליד" to "בוצע"
- **Multi-Bank:** A case can have one primary bank + multiple secondary banks

## Statuses (12)
ליד · פתיחת תיק · איסוף מסמכים · מוכן להגשה · הוגש לבנק · בהמתנה לאישור עקרוני · אושר עקרונית · בטחונות · ביצוע · תקוע · בוצע · בהקפאה

## Permissions Architecture
- **Manager** role is FIXED (all permissions)
- All other roles are **configurable in Settings** (NOT hardcoded)
- Granular permissions: view cases, edit, see financials, etc.
- Per-user overrides allowed (manager can grant exceptions)

## Manager-Only Fields (default)
- שכר טרחה שסוכם (Agreed fee)
- הכנסה צפויה (Expected income)

## Critical Features - Phase 1 (MVP, ~1 month)
1. Auth + Roles + Permissions
2. Dashboard with table view (7 columns including row number)
3. Client Card with 6 blocks
4. Documents + Google Drive sync
5. Backup automation
6. Settings (profile, roles, system)

## Phase 2 Features (post-MVP)
- Tasks + Team management
- Communications (WhatsApp/Email templates)
- Onboarding form (public)
- Bank PDF generation
- Time tracking
- Data import (Excel/CSV)
- Stage timing reminders

## Anti-Patterns (Strictly Forbidden)

These are auto-reject patterns. If you see one in a PR/review - reject without discussion.

### Code-level anti-patterns
- ❌ **Fetching data inside components** (except via hooks/Server Components)
- ❌ **Duplicating Zod schemas** - one schema, imported wherever needed
- ❌ **Mixing UI and business logic** in the same file
- ❌ **God files** (>250 lines for components, >100 for actions, >30 for utils)
- ❌ **Implicit types** - all functions need explicit return types (especially exports)
- ❌ **DB mutations inside Components** - always via Server Actions
- ❌ **Layer violations** - UI importing from Infrastructure directly
- ❌ **Type assertions (`as`)** without a code comment explaining why
- ❌ **`any` type** - use `unknown` and narrow with type guards
- ⚠️ **Prefer shared icon wrapper for repeated/system icons** (sidebar, status badges, navigation) - direct `lucide-react` imports are allowed for one-off local icons that appear only once
- ❌ **External API/OAuth logic in components** - belongs in `features/X/services/`

### Project-level anti-patterns
- ❌ Storing credit card numbers (removed from spec entirely)
- ❌ Hardcoded user-facing text (must go through i18n)
- ❌ Hardcoded role checks in code (use the configurable permissions system)
- ❌ Emojis in production UI (Lucide icons only)
- ❌ "Just for now" hacks without a tracked TODO + issue link

### When you spot an anti-pattern
1. Stop the work
2. Fix it now (it's cheaper than later)
3. If splitting → see Naming Conventions + Project Structure

## See Also
- Full spec: `C:\Users\shh92\Documents\Kaufman-Finance-Spec\Kaufman-Finance-Spec.md`
- Mockups: `C:\Users\shh92\Documents\Kaufman-Finance-Spec\mockups\`
- Repo: https://github.com/Shmuel18/first-crm
