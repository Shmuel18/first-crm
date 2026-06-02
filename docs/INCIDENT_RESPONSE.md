# Security Incident & Personal-Data Breach Runbook

What to do when client data may have been exposed, altered, or lost — or when an
account / key / integration is compromised. Keep this short enough to follow
under pressure.

> The **technical** steps below reference mechanisms that exist in this system
> today. The **Notify (legal)** section is an engineering-produced **draft, not
> legal advice** — the exact obligations and timeframes are `[[FILL: ...]]` for
> qualified Israeli counsel to confirm.

## 0. Contacts (fill once, keep current)

| Role | Who | Reach |
|---|---|---|
| Incident lead (decides + coordinates) | `[[FILL: name]]` | `[[FILL: phone/email]]` |
| Security/tech contact | `[[FILL:]]` | `[[FILL:]]` |
| Legal counsel (Israeli privacy law) | `[[FILL:]]` | `[[FILL:]]` |
| Supabase support / project owner | `[[FILL:]]` | dashboard → Support |

## 1. Triage (first 15 minutes)

1. **Write down** the time, what you observed, and how you found out. Start a
   timeline note — every later step appends to it.
2. **Classify:**
   - *Personal data involved?* (borrower national IDs, contact, financials,
     documents.) If yes → this is a **personal-data breach**, the legal section
     applies.
   - *Severity:* confirmed exposure/loss > suspected > contained-near-miss.
3. **Don't destroy evidence.** Do not delete rows, audit logs, or containers
   until scope is captured. (`audit_log` is append-only by design — keep it.)

## 2. Contain (stop the bleeding)

Pick what fits the incident — all of these exist today:

- **Compromised user account** → deactivate them immediately:
  - In-app: **/team → toggle the member inactive**, or
  - SQL Editor: `SELECT public.set_member_active('<uid>', false);` *(adjust to
    the actual RPC/UI)*, then `SELECT public.revoke_user_sessions('<uid>');`
  - Effect: the proxy bounces their live session on the next request
    (`current_user_active()` gate, migration 122) and refresh tokens are killed.
- **Your own session may be compromised** → Settings → Security → **Sign out
  everywhere**.
- **A leaked secret / key** → rotate it (see §5 checklist) and redeploy.
- **A compromised integration** (Google Drive) → Settings → Integrations →
  **Disconnect**; revoke the app's access from the Google account too.
- **App-level compromise / bad deploy** → roll back to the previous image
  (`first-crm:prev`) — see `DEPLOYING.md` / `FRANKFURT_MIGRATION_HANDOFF.md`.
- **Suspected mass data exfiltration** → check exports (§3) and consider
  disabling the affected accounts until assessed.

## 3. Assess scope (what / whose / how much)

- **Who did what, when** — `audit_log` (admin-only). Example:
  ```sql
  SELECT timestamp, user_id, action, table_name, record_id
    FROM public.audit_log
   WHERE timestamp > now() - interval '7 days'
     AND action IN ('EXPORT','DELETE','UPDATE')
   ORDER BY timestamp DESC;
  ```
  Notes: financial values are excluded from audit by design; and audit rows for
  **permanently-deleted** records are PII-redacted (`{"_redacted":true}`,
  migration 133) — the skeleton (who/when/which record) survives.
- **Exports** (a key exfiltration signal) — rows with `action = 'EXPORT'`
  (migration 038) show who exported and when.
- **Identify affected data subjects** — which borrowers / cases, and which data
  categories (IDs, contact, financials, documents). Record counts for the legal
  notification.

## 4. Eradicate & recover

1. **Fix the root cause** (patch, revoke, rotate) before restoring access.
2. **Verify the platform** — `curl -s https://<host>/api/health` → `{"ok":true}`.
3. **If data was altered or lost** → restore from backup: **`RESTORE_RUNBOOK.md`**
   (encrypted nightly snapshot; restore now includes the simulator tables —
   QA-2 fix). Verify row counts after.
4. **Re-enable accounts** only once you're confident they're clean.

## 5. Notify (legal) — DRAFT, confirm with counsel

> `[[FILL: This section must be confirmed by Israeli privacy counsel.]]`

If personal data was breached, Israeli law imposes notification duties on the
**data controller (the office)**:

- **Privacy Protection Authority (הרשות להגנת הפרטיות)** — the Protection of
  Privacy Regulations (Data Security), 5777-2017 require notifying the Authority
  of a **severe security event**; Amendment 13 (in force 2025) expands duties,
  including notifying **affected data subjects**.
  `[[FILL: exact triggering threshold, deadline, and method — counsel]]`
- **Affected borrowers (data subjects)** — `[[FILL: whether/when/how to notify]]`.
- **Sub-processors** — check breach notices and your obligations toward
  Supabase, Google (Drive), Resend, and Sentry — see `docs/legal/SUB_PROCESSORS.md`.
- Keep a written record of what was decided and when (regulators expect this).

## 6. Post-incident

- Finalize the timeline; write a short root-cause + remediation note.
- File follow-up fixes (close the vulnerability class, not just the instance).
- Update this runbook with anything that was missing.

---

## Appendix — quick reference

| Need | Where |
|---|---|
| Platform health | `GET /api/health` → `{"ok":true,"db":<ms>}` |
| Deactivate user + kill sessions | `/team` toggle, or `set_member_active` + `revoke_user_sessions` (mig 122) |
| Sign out my own sessions | Settings → Security → Sign out everywhere |
| Who exported / changed what | `audit_log` where `action IN ('EXPORT','UPDATE','DELETE')` |
| Restore data | `RESTORE_RUNBOOK.md` |
| Roll back the app | `first-crm:prev` — `DEPLOYING.md` |
| First-admin after clean restore | `BOOTSTRAP.md` |

### Secret-rotation checklist (when a key may have leaked)
Rotate in `.env.production` **and** redeploy; some have extra steps:

- `INTEGRATION_ENCRYPTION_KEY` — encrypts stored Google tokens. Rotating
  invalidates existing encrypted tokens → **reconnect Google Drive** afterward.
- `BACKUP_ENCRYPTION_KEY` — encrypts backups. Keep the OLD key until you've
  confirmed you can still restore older snapshots (restore is key-aware).
- `CRON_SECRET` — gates `/api/cron/*`; update the host cron env too.
- **Supabase keys** (service-role / publishable / DB password) — rotate from the
  Supabase dashboard; update `.env.production`; service-role leakage is highest
  severity (bypasses RLS).
