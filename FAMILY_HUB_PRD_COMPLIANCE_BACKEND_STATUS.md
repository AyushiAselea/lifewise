# Family Hub — PRD Compliance: Backend Status

**Audience:** Frontend team
**Date:** 2026-08-17
**Source doc:** `Family Hub — PRD Compliance: Backend Requirements` (2026-08-14)

This is the status update against that doc's TL;DR table. Short version:
**the 9 new record kinds are live** — you can start sending real traffic to
them. Everything else in the requirements doc (§4, §5, §6) is **not yet
built**.

---

## ✅ Done — safe to use now

### §2: 9 new record-kind CRUD routes

All 9 previously-missing `:kind` segments are now registered on the existing
generic CRUD contract:

```
GET    /api/family/:memberId/:kind
POST   /api/family/:memberId/:kind
PATCH  /api/family/:memberId/:kind/:recordId
DELETE /api/family/:memberId/:kind/:recordId
```

Segments added: `dietProfile`, `fitnessItems`, `studyProfile`, `moodLogs`,
`wellnessReminders`, `vehicles`, `fuelLog`, `homeMaintenance`,
`emergencyProfile`.

- Same contract as the 12 existing kinds — no new auth, no new response shape.
- The three single-record kinds (`dietProfile`, `studyProfile`,
  `emergencyProfile`) work exactly as specified: POST a record whose `id`
  equals the `memberId`; a repeat POST with the same `id` upserts in place
  (confirmed — does not duplicate).
- Records store whatever fields you send, as-is (schemaless) — no allowlist
  to keep in sync on our side as your record shapes evolve.
- Caregiver visibility matches the existing 12 kinds exactly: the member's
  owner and every accepted connected caregiver can read and write, including
  `emergencyProfile`.

**Not yet load-tested against production traffic** — please run the §7
verification steps from the requirements doc against your dev/staging
environment (POST + GET round-trip per kind, double-POST idempotency check on
the 3 single-record kinds, caregiver-read check on `emergencyProfile`) and
flag anything that doesn't match.

### §3: New fields on the 8 existing record kinds

**No backend change was needed.** The existing record routes were already
schemaless — they persist and return whatever fields are sent, with no field
allowlist stripping unknown keys. All the new fields listed in §3.1–§3.9 of
the requirements doc (`familyBills.accountNumber`, `appointments.notes`,
`healthLogs.systolic`/`diastolic`, `subscriptions.planType`, etc.) already
round-trip correctly. If you've seen any of these fields disappear on
refetch, it's not a server-side stripping issue — flag the specific field and
kind and we'll look at it as a bug, not a missing-feature request.

---

## ⏳ Not done yet

### §4: New fields on `POST /api/family/:memberId/medicines`

The medicines endpoint is separate from the record-sync layer and still uses
an explicit field allowlist. `frequency`, `daysOfWeek`, `reminderEnabled`,
`snoozeDuration`, and `doctorNotes` are being sent by the app today and are
**silently dropped** — this is real, ongoing data loss, not just a future
gap. Not fixed in this pass.

### §5: Reminder-engine work

Nothing in §5 (medicine frequency honoring, lead-time reminders, recurrence
regeneration, new-module reminders, missed check-in follow-up, caregiver
fan-out) has been started. Records for the new modules save correctly, but
no notifications will fire for them yet.

### §6: S3 document upload + secure share link

Not started. Still flagged as not-built, same as before this update.

---

## What this means for you right now

- Safe to point the app's already-shipped payloads for the 6 new modules at
  the live routes — data will persist and survive reinstall/second-device.
- Do **not** expect reminders/notifications for any of the 6 new modules yet.
- Medicine `frequency`/`daysOfWeek`/`reminderEnabled`/`snoozeDuration`/
  `doctorNotes` will keep silently vanishing on refetch until §4 ships —
  worth knowing if QA is currently testing that form.
- Document upload/share-link UI should stay in its flagged "not built" state.

We'll follow up with a separate update as §4/§5/§6 land.
