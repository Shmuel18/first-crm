# First-admin bootstrap

How a brand-new database (a fresh install, or a disaster-recovery restore into a
clean Supabase project) gets its **first manager** account.

## Why this is needed

The app has no self-signup path by design:

- `handle_new_user` (migration 059) refuses to create a profile unless the auth
  user was created through the team-invite flow (it carries an `invited_by`
  metadata field).
- The team-invite flow (`/team` → "Add team member") requires an **existing
  admin** to run it.

So on an empty database there is no admin to send the first invite, and a raw
sign-up would land a profile-less user that RLS locks out of everything. The
first manager must be provisioned out-of-band, once.

## Procedure (one time)

> Requires Supabase project access (Dashboard + SQL Editor).

1. **Create the auth user** — Supabase Dashboard → **Authentication → Users →
   Add user**. Enter the manager's email + a temporary password, and tick
   "Auto Confirm User". (This creates the `auth.users` row; because it has no
   `invited_by`, no profile is created yet — that's expected.)

2. **Promote them to admin** — Supabase Dashboard → **SQL Editor**, run:

   ```sql
   SELECT public.bootstrap_first_admin('manager@example.com');
   ```

   Use the same email as step 1. It returns the new admin's UUID.

3. **Log in** to the app with that email + password, then add everyone else the
   normal way from **/team** (magic-link invites). Have the manager change their
   password under **Settings → Security**.

That's it.

## Safety properties

- **Self-disabling.** `bootstrap_first_admin` only acts while **no active admin
  exists**. The moment the first manager is provisioned it refuses every further
  call — it can't be used to escalate privileges later.
- **Operator-only.** `EXECUTE` is revoked from `PUBLIC`; only the
  postgres/service role (i.e. the SQL Editor) can call it. The app cannot.
- **Idempotent-ish.** If step 1's user already has a (junior) profile, the
  function upgrades it to admin rather than erroring.

## Troubleshooting

| Error | Cause / fix |
|---|---|
| `no auth user with email …` | Step 1 wasn't done, or the email differs. Add the user in Authentication first; emails are matched lowercased. |
| `bootstrap_first_admin is disabled: an active admin already exists` | An admin is already set up — this is the normal post-setup state. Use `/team` to add members. |
| `admin role is missing …` | The lookups seed (migration 004) hasn't been applied to this database. |

## Disaster recovery

After restoring a backup into a clean Supabase project, the `profiles` rows come
back with the restore — so an admin usually already exists and you do **not**
need this. Only use the bootstrap when starting from a genuinely empty schema
(fresh migrations, no data).
