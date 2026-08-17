# Family Reminders on Home Dashboard — Backend Status

**Audience:** Frontend team
**Date:** 2026-08-17
**Source doc:** `Family Reminders on Home Dashboard — Backend Requirements` (2026-08-15)

Status against that doc's TL;DR table:

| # | Work | Status |
|---|---|---|
| 1 | `GET /api/reminders/family` | ✅ Already live (predates this update) |
| 2 | `memberAvatarUrl` on each row | ✅ Added in this update |
| 3 | Server-side scheduling + push (§4) | ❌ Not built |

---

## ✅ Done

### §2: `GET /api/reminders/family`

Already implemented and live — `server/routes.ts`. Auth required, returns a
flat `FamilyReminder[]`, scoped to members the requester owns **or** is an
accepted connected caregiver on (§2.3's access rule — the caregiver-connected
system this depended on is in fact built, contrary to the requirements doc
calling it "still unbuilt").

**What changed today:** the projection (`server/family-reminders.ts`) was
missing two fields the spec requires. Both are fixed now:

- **`memberAvatarUrl`** — the one field §2.2 explicitly called out as new.
  Every row now carries the member's `avatarUrl` (same value already on the
  `family_members` document), or `null` if the member has no photo.
- **`recurrence`** — routine and check-in rows now include
  `{ hour, minute, weekdays }` derived from the record's `time` and `days`
  fields (0=Sun..6=Sat; empty `weekdays` = every day). Previously this field
  was silently omitted entirely for the two recurring kinds.

Everything else in §2.2's row shape (`id`, `name`, `amount`, `dueDate`,
`category`, `isPaid`, `icon`, `reminderType`, `repeatType`, `status`,
`reminderDaysBefore`, `source`, `memberId`, `memberName`, `sourceKind`,
`sourceId`) matched already — no other changes needed.

`id` stability (doc §5, verification step 3) is unaffected by this change —
it's still built only from `sourceKind:memberId:sourceId`, deterministic
across repeated GETs.

### §3: The `[]` vs non-empty contract

Already correct, no change needed. The endpoint returns `[]` when a
requester has no family records (not a 404), and returns real rows once
records exist — matching the client's fallback-to-local behavior described in
the requirements doc.

**⚠️ The trap the requirements doc calls out still applies**: this endpoint
can now return non-empty rows with a populated `memberAvatarUrl` and
`recurrence`, but **no push is being sent for them yet** (see §4 below). If
the client is live and any user's account currently produces non-empty
reminders, they will see **zero notifications** for those Family Hub
reminders — worse than the local-only fallback. Do not treat this endpoint
going non-empty as a signal that push is also live; it isn't.

---

## ❌ Not done

### §4: Server-side scheduling + push

Confirmed by code inspection: there is an existing reminder scheduler in
`server/routes.ts` (`startReminderScheduler`), but it only reads from the
`bills` collection — it does not consume `projectFamilyReminders` /
`projectMemberReminders` at all. No push notification is sent for any
Family Hub-derived reminder today. This is real, unstarted work, not a
partial implementation.

---

## What this means for you right now

- The photo you asked for (§2.2) will render correctly for any account
  already fetching from this endpoint.
- Routine/check-in rows now carry a real `recurrence` schedule instead of a
  missing field — if the client was defensively coding around its absence,
  that workaround is no longer needed (but leaving it in place is harmless).
- Do **not** flip any client-side assumption that switches off local
  notification scheduling based on this endpoint alone — push isn't wired up
  yet, and doing so would silently disable reminders for affected users
  (exactly the failure mode §3 of the requirements doc warns about).
- We'll follow up separately once §4 (scheduling + push) lands.
