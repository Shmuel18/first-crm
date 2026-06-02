# Legal documents — DRAFTS (not legal advice)

> ⚠️ **These are engineering-produced DRAFTS, not legal advice.** They MUST be
> reviewed and finalized by qualified Israeli legal counsel before they are
> relied on, published, or presented to clients. They were written to be
> *grounded in what the software actually does* (data collected, sub-processors,
> security, retention) so counsel starts from an accurate description — not to be
> authoritative law.

## The two relationships these cover

1. **Software provider ↔ the office (paying customer)** — `TERMS_OF_SERVICE.md`
   + `SUB_PROCESSORS.md`. In data-protection terms the **office is the data
   controller**, the software/provider is a **processor**, and the vendors listed
   in SUB_PROCESSORS are **sub-processors**.
2. **The office ↔ its borrowers (data subjects)** — `PRIVACY_NOTICE.md`. A notice
   the **office** presents to its clients. (The app itself has no borrower-facing
   screen — borrowers don't log in — so this is presented off-platform, e.g. at
   engagement.)

## Files

| File | Audience | Purpose |
|---|---|---|
| `PRIVACY_NOTICE.md` | Office → borrowers | What borrower data is collected, why, by whom, retention, rights |
| `TERMS_OF_SERVICE.md` | Provider → office | Terms binding the paying customer's use of the Service |
| `SUB_PROCESSORS.md` | Provider → office | Register of third-party processors (for the DPA + privacy notice) |

> **Breach response** is operational, so it lives outside this folder:
> `../INCIDENT_RESPONSE.md`. Its "Notify (legal)" section — the data-breach
> notification duties under Israeli law — is a draft that also needs counsel review.

## Placeholders

Anything only you / counsel can decide is marked **`[[FILL: ...]]`** — registered
business name, address, privacy contact, governing-law jurisdiction, the binding
retention periods, etc. Grep for `[[FILL` to find them all.

## Status / next steps

- [ ] **Counsel review** — especially the Hebrew legal wording (drafted by a
      non-lawyer) and the **retention periods**.
- [ ] Fill the `[[FILL: ...]]` placeholders.
- [ ] **Decide retention periods.** Israeli financial-advisory record-keeping
      likely requires **multi-year** retention. The app's current code defaults
      are **365 days** (audit log) and **14 days** (purge after soft-delete) —
      almost certainly too short to be the *legal* retention; counsel must set the
      real period and the app config (`office_settings.audit_log_retention_days`,
      `deleted_records_retention_days`) should then be aligned.
- [ ] Only **after the text is final**, wire into the app (a `/legal` route +
      login-footer link). No value in shipping placeholder legal text to a live
      paying customer.

## What was deliberately NOT claimed

To keep these accurate, the drafts do **not** assert security controls that
aren't actually enforced (e.g. MFA exists in the app but is **not enforced**, so
it is not listed as an active safeguard). Only verifiable measures are stated.
