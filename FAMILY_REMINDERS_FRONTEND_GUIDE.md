# Family Hub Reminders — Backend Complete, Frontend Integration Guide

**Audience:** Frontend team
**Status:** All three phases from the original spec (`Family Hub Reminders — Backend Specification`, 2026-07-31) are implemented. Committed locally on `main` @ `26c5a1d`, not yet pushed to the remote — ask backend before assuming this is deployed.
**Verification:** Every endpoint and the scheduler below was exercised against the real MongoDB Atlas instance with disposable test users (registered, tested, then deleted — no lingering test data). Not tested: an actual FCM push to a physical device (no real push token was available in this pass) — the code path that sends it is unchanged from the existing, already-shipped bill/medicine reminder push code.

---

## 0. TL;DR

| # | Item | Status |
|---|---|---|
| 1 | Family record CRUD for all 14 features | **Already existed** — no change needed |
| 2 | Caregiver read/write on those records | **Fixed** — was owner-only, now works for shared caregivers |
| 3 | `GET /api/reminders/family` (projection) | **New** |
| 4 | Server-side push for family reminders | **New** |
| 5 | Client-side cutover (stop local scheduling) | **Not started — your side** |

Nothing here requires new frontend UI. It requires swapping the client's local
projection (`lib/family-reminders.ts`) for the server's, per the migration
sequence in §6.

---

## 1. Caregiver access — bug fix, not a new endpoint

If you tested caregiver sharing before and saw empty lists for shared family
members, that's why: `GET/POST/PATCH/DELETE /api/family/:memberId/<kind>` only
checked `member.userId === requesterId`. A caregiver in
`connectedCaregivers` was rejected with 404.

Fixed — a caregiver accepted via the existing invite flow
(`POST /api/family/:memberId/connected-caregivers/invite` →
`POST /api/caregiver-invites/:inviteId/accept`) now gets full read/write on
every one of the 14 feature arrays, plus `emergencySettings`,
`emergencyLog`, and `customConfig`. No client changes needed — this was
already how your code called the API, the server just wasn't honoring it.

---

## 2. `GET /api/reminders/family`

Returns the exact `Bill`-shaped projection, scoped to family members you own
**or** are a connected caregiver for (same visibility as
`/api/family/shared-with-me`).

```
GET /api/reminders/family
Authorization: Bearer <token>
```

```json
[
  {
    "id": "fam:appointment:6a6c820d6853f085f1e2340a:1785496194477-xdopnzqng",
    "memberId": "6a6c820d6853f085f1e2340a",
    "memberName": "Sunita Baheti",
    "sourceKind": "appointment",
    "sourceId": "1785496194477-xdopnzqng",
    "name": "Dr. Mehta · Sunita Baheti",
    "amount": 0,
    "dueDate": "2026-08-04T10:30:00.000Z",
    "category": "health",
    "icon": "medkit",
    "reminderType": "custom",
    "repeatType": "none",
    "status": "active",
    "isPaid": false,
    "reminderDaysBefore": [1, 0],
    "source": "family"
  }
]
```

All 16 fields are always present. `POST`/`PUT`/`PATCH`/`DELETE` against this
path return `405` — it's derived, not stored; mutate the underlying record
via the existing `/api/family/:memberId/<kind>/...` routes instead, and the
projection updates automatically on the next `GET`.

### What's included and what's filtered

Same 8 kinds, same skip rules as your local `lib/family-reminders.ts` — this
was built to match it field-for-field, not reinvented:

| `sourceKind` | Included when | Excluded when |
|---|---|---|
| `appointment` | has a parseable `date` | `completed: true` |
| `medicine-stock` | `dailyUsage > 0` | `dailyUsage <= 0` (would divide by zero) |
| `family-bill` | has a parseable `dueDate` | `isPaid: true` |
| `subscription` | has a parseable `renewalDate` | `isPaid` or `cancelled` |
| `task` | has a parseable `dueDate` | no `dueDate`, or `completed: true` |
| `routine` | `enabled !== false`, has `time` | `enabled: false` |
| `checkin` | `enabled !== false`, has `time` | `enabled: false` |
| `travel` | has a parseable `date` | `completed: true` |

Any record whose date field fails to parse is silently dropped, not surfaced
as `"Invalid Date"` — matches what your projection already does.

**Medicine refill date** is recomputed on every call, never cached:
`refillDate = today + max(0, floor((quantityRemaining - lowStockThreshold) / dailyUsage))`,
set to 09:00 local server time. Verified live: dropping `quantityRemaining`
from 20 to 10 (with `lowStockThreshold: 5, dailyUsage: 2`) moved the returned
`dueDate` from Aug 7 to Aug 2 on the very next `GET` — no stale caching.

**Routine/check-in dates** resolve the stored `"HH:MM AM/PM"` clock time to
the next occurrence (today if still ahead, else tomorrow), same as your
client logic.

**Known gap, intentionally not fixed:** `CheckinItem.days` (weekday filter)
is **not** honored server-side — every check-in is still treated as daily,
matching your current client behavior per the original spec's §3.2. If/when
you implement `days` filtering client-side, flag it and we'll mirror it
server-side in the same change, so the two never diverge.

### Title format

`"<title> · <memberName>"` — middle dot (U+00B7), space on both sides,
verified byte-for-byte in the live response. Safe to `.split(' · ')` as your
code already does.

---

## 3. Server-side push notifications

The existing reminder scheduler (the same one that already emails/pushes
regular bill reminders) now also evaluates the family projection every 60
seconds, using a 5-minute look-ahead window, and sends for every
`(reminder, daysBefore)` pair whose fire time (`dueDate - daysBefore days`)
falls inside that window.

**Recipients:** owner **and every connected caregiver** for that family
member — this resolves open question §7.4 from the original spec by
following the precedent already set by the existing medicine-reminder code
(`getRecipientUserIds`), which already fans out to both.

**Payload — verified live, matches spec exactly:**

```json
{
  "notification": { "title": "Dr. Mehta · Sunita Baheti", "body": "Dr. Mehta · Sunita Baheti is due today" },
  "data": {
    "type": "family-reminder",
    "memberId": "6a6c820d6853f085f1e2340a",
    "sourceKind": "appointment",
    "sourceId": "1785496194477-xdopnzqng"
  }
}
```

Body copy: `"<title> is due today"` at `daysBefore === 0`, otherwise
`"<title> in N day"` / `"in N days"` (singular at exactly 1) — matches your
client's copy generator.

An in-app row is also written to `/api/notifications` with
`type: "family-reminder"` and the same `meta` object (no `route` field — none
of your existing notification-detail screens have a path for a composite
`fam:...` id, so nothing is included there; if you want tap-to-navigate on
these, tell us what route to add and we'll add `meta.route`).

**Deduplication verified two ways:**
1. Running the scheduler tick repeatedly against the same due reminder does
   not create duplicate `notifications`/log rows — confirmed by checking the
   underlying `reminder_logs` collection stayed at a constant count across
   three consecutive ticks.
2. Marking the source record complete (or deleting the family member)
   *before* its fire time correctly results in zero notifications — verified
   for both cases live.

**Not sent for:** completed/paid/cancelled/disabled records (per the table in
§2), or any lead time whose fire time has already passed relative to now
(prevents a backdated burst when a bill is added on its due date) — both
confirmed live.

---

## 4. Client-side cutover — this is on you

Per the original spec's §6, nothing changes automatically — the client is
still scheduling everything locally today, and turning on the server path
without a coordinated client change means **every reminder fires twice**
(once from your local `expo-notifications` schedule, once from the server
push). Sequence:

1. **Now:** you can start calling `GET /api/reminders/family` and compare its
   output against your local projection in a non-shipping build, to confirm
   they agree before cutting over anything user-facing.
2. **When ready:** switch the Reminders tab to prefer
   `GET /api/reminders/family`, keep local projection only as an offline
   fallback (spec §6 step 2).
3. **Coordinate with backend before this step:** disable local
   `expo-notifications` scheduling for any reminder the server now covers,
   and clear the `@lifewise_family_reminder_scheduled` AsyncStorage key. Do
   this in the **same release** the server push goes live for real devices —
   it already is live in the backend code, so the double-fire risk starts
   the moment you point at real push tokens in production, not at some
   future backend milestone.

---

## 5. Open items carried over from the original spec

These weren't backend's call to make unilaterally — flagging per the
original spec's §7 so a decision can be made together:

1. **Timezones** — routines/check-ins fire based on the *server's* local
   time interpretation of the stored clock string. There's no per-user
   timezone field yet. If your users span timezones, this will fire at the
   wrong wall-clock time for some of them. Need a decision: add `timezone` to
   the user profile, or send an IANA zone with each record?
2. **Check-in `days`** — see §2 above. Server intentionally matches your
   current (not-yet-`days`-aware) behavior; will update in lockstep whenever
   you add it.
3. **Recurrence rollover** — for monthly/yearly bills and subscriptions, the
   server does **not** auto-advance `dueDate`/`renewalDate` after a fire.
   Same as before: the client is expected to update the date on payment, as
   it does today.
