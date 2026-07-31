# Family Hub Notifications — Backend Complete, Frontend Integration Guide

**Audience:** Frontend team
**Status:** The core of `FAMILY_HUB_NOTIFICATIONS_BACKEND_REQUIREMENTS.md` was already built in an earlier pass (the Family Hub Reminders scheduler). This round fixed the one real bug in it and closed the gap between what that scheduler produced and what this spec specifically asked for. Committed and pushed to `main` (`dc81fe2`).
**Verification:** Live-tested against the real database with a disposable test user — not just read from code.

---

## 0. TL;DR

| Spec item | Status |
|---|---|
| §3.0 prerequisite: records must exist server-side | Already true — see `FAMILY_RECORDS_SYNC_FRONTEND_GUIDE.md` |
| §3.1 generate notifications into the same `notifications` collection | Already true |
| §3.2 kind/lead-time table | Already matches exactly |
| §3.3 dedup, timezone-safe | **Bug found and fixed** — see §1 below, this was real |
| §3.4 push via existing FCM path | Already true |
| §3.5 caregiver fan-out | Already true |
| §4 client cutover readiness | Backend side is ready now |
| §5 acceptance criteria | See §3 below, checked one by one |

**The one thing you actually need to know:** daily-repeating reminders
(routines, check-ins) had a real bug where they'd notify once, ever, and then
go permanently silent. That's fixed now. Nothing else in your integration
needs to change — the notification shape was already correct, this was a
scheduler-internal defect.

---

## 1. The bug: daily reminders fired once and then never again

Routines and check-ins repeat daily at a fixed clock time (`"08:00 AM"`, no
date). Their identity — `fam:routine:<memberId>:<sourceId>` — is the *same
string every day*, because it's built from the record, not from a specific
occurrence.

The scheduler's duplicate-prevention was keyed on that identity alone. The
first time a routine's reminder fired, it wrote a dedup row that matched
every future check for that same routine — forever. In practice: a user's
"take medicine at 8am" routine would notify once on day one and then silently
stop. This is exactly the failure mode described in this spec's §3.3 warning
about the dedup key needing a date component, and it turned out to be real.

**Fixed:** the dedup key now includes the calendar day, but only for
`repeatType === 'daily'` reminders (routines, check-ins) — one-off kinds
(appointments, bills, tasks, subscriptions, travel) don't need this, since
their underlying due date is a specific moment that doesn't recur.

**The date is computed in local server time**, not
`toISOString().slice(0,10)` — the spec's own warning about that UTC rollover
(a late-evening IST reminder would get tomorrow's date key) was correct, and
the fix uses `getFullYear()/getMonth()/getDate()` instead.

**Verified live:** created a routine due a couple of minutes out, confirmed it
fired exactly once, confirmed the stored dedup key includes today's date
(`fam:routine:<memberId>:<sourceId>:2026-07-31`), confirmed a second and
third scheduler tick on the same day did *not* duplicate it. Tomorrow's key
will be `...:2026-08-01` — a different string, so tomorrow's occurrence is
not blocked by today's.

**No action needed from you** — this was entirely a backend scheduling
defect. If you've seen bug reports about routines/check-ins "only notifying
the first day," this is that bug, now fixed.

---

## 2. Notification shape — confirmed to match your spec exactly

```json
{
  "id": "6a6ca441bfa8343966d85dc9",
  "type": "reminder",
  "title": "Morning Walk · Routine Test Member",
  "body": "Morning Walk · Routine Test Member is due today",
  "read": false,
  "createdAt": "2026-07-31T13:33:53.499Z",
  "meta": {
    "type": "family",
    "kind": "routine",
    "memberId": "6a6ca312bfa8343966d85dc8",
    "sourceId": "routine-dedup-test",
    "referenceId": "routine-dedup-test",
    "route": "/family-reminder/fam:routine:6a6ca312bfa8343966d85dc8:routine-dedup-test",
    "redirectUrl": "/family-reminder/fam:routine:6a6ca312bfa8343966d85dc8:routine-dedup-test"
  }
}
```

Verified live via `GET /api/notifications` — same endpoint you already poll,
no new endpoint. Matches your §3.1 example exactly: `meta.type === 'family'`,
`meta.kind` set to the source kind, `route`/`redirectUrl` present and in the
`/family-reminder/fam:<kind>:<memberId>:<sourceId>` format your app already
navigates to from the interim client-side projection.

**This closes the two limitations your interim fix called out explicitly:**
- These rows now have a **real server `id`** — verified `POST
  /api/notifications/mark-read` with that id correctly persists `read: true`
  on a subsequent `GET`.
- They now come through `GET /api/notifications`, so they're counted by
  whatever unread-badge logic already reads that endpoint — no separate
  merge needed.

---

## 3. §5 acceptance criteria, checked

- [x] A family reminder produces a row from `GET /api/notifications` with
      `meta.type === 'family'` — verified live.
- [x] The row includes a route to the record detail screen — verified live
      (see §2). *(We're taking your word that `/family-reminder/:id` exists
      and is what your interim projection already links to — we don't have
      that screen in this checkout to click through ourselves.)*
- [ ] **Fires as push with the app fully closed** — the FCM send path
      (`sendEachForMulticast`) executes and did not error in testing, but we
      did not verify an actual push arriving on a physical device this pass
      (no real device/token available). This is the same, already-shipped
      code path used for regular bill and medicine reminders — if those work
      today, this does too, but flagging that this specific criterion wasn't
      re-verified end-to-end this time.
- [x] Appears on a second device signed into the same account — this is just
      `GET /api/notifications` being account-scoped, not device-scoped;
      already true, not specific to family reminders.
- [x] Survives uninstall/reinstall — it's a database row, not local state.
- [x] Marking it read persists across a restart — verified (§2).
- [x] A daily routine fires once per day, not every cron tick — verified,
      this was the bug in §1.
- [x] Date key correctness for a user near midnight IST — addressed by using
      local server time instead of UTC, per §1. Not separately verified at
      an actual midnight boundary this pass (would need to either wait for
      one or manipulate the server clock, neither of which was practical
      here) — the fix is structurally correct (local calendar fields, not a
      UTC string slice) but flagging that the specific midnight-boundary
      scenario wasn't observed live.
- [x] Connected caregivers receive the same notification — verified earlier
      (see `FAMILY_REMINDERS_FRONTEND_GUIDE.md` §3): both owner and a
      connected caregiver received a notification for the same reminder in
      that pass, and this change didn't touch the fan-out logic.

---

## 4. Client cutover — you're clear to proceed

Per this spec's §4, the interim client-side projection in
`app/notifications.tsx` can now be removed:

1. Delete `familyReminderToNotification()` and the merge block — server rows
   arrive through your existing `GET /api/notifications` fetch.
2. Family rows get real read state automatically once you stop special-casing
   them.
3. Your unread badge count picks them up with no change, since it's presumably
   already counting unread rows from that same endpoint.

**One thing to double check before cutting over:** your interim rows and the
server's rows will have different `id` formats (`fam:...` composite vs. a
real Mongo ObjectId string). If any client code branches on `id.startsWith('fam:')`
to detect an interim row, that logic should be removed in the same change —
after cutover, every family notification has a normal server id.

---

## 5. Open questions from the original spec — still open

These are product decisions, not something fixed by this backend change:

1. **Lookahead window** — your client shows 7 days; the server's lead times
   (§3.2's table, unchanged) top out at 3 days before. If you want a longer
   lookahead than the lead times themselves produce, that's a product
   decision about whether reminders should notify further in advance, not
   something this change addresses.
2. **Retention** — no pruning job exists for the `notifications` collection.
   Daily routines/check-ins will add one row per member per day indefinitely.
   Worth deciding a retention policy before this is at scale.
3. **Per-feature opt-out** — no settings shape exists for muting, say,
   routine notifications while keeping bills. Flag if/when there's a UI for
   this and we'll build the corresponding filter.
