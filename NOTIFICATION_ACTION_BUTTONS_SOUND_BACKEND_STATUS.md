# Notification Action Buttons & Custom Sound — Backend Status

**Audience:** Frontend team
**Date:** 2026-08-17
**Source doc:** `Notification Action Buttons & Custom Sound — Backend Requirements` (2026-08-17)

Status against that doc's TL;DR table:

| # | Work | Status |
|---|---|---|
| 1 | Category identifier on reminder pushes (§2.1) | ✅ Done |
| 2 | `sound: "reminder.wav"` on reminder pushes (§2.2) | ✅ Done |
| 3 | `minutes` honoured on snooze action (§3) | ✅ Already worked, confirmed |
| 4 | Server-side re-fire after snooze (§4) | ❌ Not done (doc marks this optional) |

---

## ✅ Done

### §2.1 / §2.2: category + sound on reminder pushes

`server/push.ts` — `sendPushToTokens` (and both wrapper functions,
`sendPushToUser` / `sendPushToTokenDocs`) now accept an optional
`categoryId` on the payload. When set to `REMINDER_ACTIONS_CATEGORY`
(`'lifewise_reminder_actions'`, exported from `push.ts`):

- **Android** — `android.notification.clickAction` is set, and `categoryId`
  is also included in the `data` block (per the doc's belt-and-braces
  instruction), plus `android.notification.sound: 'reminder.wav'`.
- **iOS** — `apns.payload.aps.category` is set, and
  `apns.payload.aps.sound` switches from `'default'` to `'reminder.wav'`.
- **Silent/data-only pushes are unaffected** — `categoryId` only has an
  effect when `channelId` is also set (i.e. a visible notification), so it
  cannot leak onto a background sync push.

Applied to exactly the three reminder-type push call sites in
`server/routes.ts`, matching the doc's list:
- `type: 'reminder'` (bill reminders)
- `type: 'medication'` (medicine dose reminders)
- `type: 'family-reminder'` (Family Hub projected reminders)

**Deliberately NOT applied** to `caregiver-invite`, `caregiver-invite-accepted`,
`sync` (silent caregiver-sync pushes), or the missed-medicine `emergency`
alert — none of these have a Snooze/Done concept, matching §2.1's
instruction.

### §2.3: payload fields for the Done button

No change needed — already correct before this update. Confirmed each
reminder-type push carries what the Done handler needs:
- `type: 'reminder'` → `billId`
- `type: 'family-reminder'` → `memberId`, `sourceKind`, `sourceId`

### §3: `minutes` on snooze

Confirmed by reading `POST /api/bills/:id/actions`
(`server/routes.ts`) — `snoozeMinutes` is read first and takes priority over
`days` whenever it's a positive number, so `{action:'snooze', days:0,
minutes:10}` correctly produces a 10-minute snooze. No change was needed;
this was already correct.

---

## ❌ Not done

### §4: Server-side re-fire after snooze

Not implemented. The doc marks this as optional ("not required... flagging
it because it's the kind of thing that gets reported as a bug months
later"). Snooze still works via the client's local re-arm; a snooze pressed
on one device won't reappear on a second device or survive a reinstall.

---

## ⚠️ One thing to check before you rely on this

The requirements doc describes the client side of this feature —
`lifewise_reminder_actions` category registration,
`lib/notification-actions.ts`, and the `reminder.wav` asset — as **already
shipping**. None of the three exist in this repository as of this update
(no match for `lifewise_reminder_actions` or `notification-actions` anywhere
outside `server/`, and no `.wav` file or `assets/sounds/` directory at all).

That may just mean those pieces live in a different repo/branch than the one
this backend work was done against — but worth confirming before assuming
buttons will actually render. The backend fields are ready and waiting
either way; they're inert extra payload data until a client reads them.

---

## Correction to an earlier status doc

`FAMILY_REMINDERS_HOME_DASHBOARD_BACKEND_STATUS.md` (sent earlier today)
incorrectly stated that server-side scheduling and push for Family Hub
reminders (§4 of that doc) was not built. On closer reading of
`server/routes.ts`, it already is — there's a scheduler
(`startReminderScheduler`, same function that handles bill reminders) that
calls `projectFamilyReminders` and sends push with the exact
`memberId`/`sourceKind`/`sourceId` fields the Done button needs. Apologies
for the bad status — that earlier doc's §4 line should be read as "already
built," not "not built."

---

## How to verify

Same steps as the requirements doc's §5, now that §2.1/§2.2/§3 are in place:

1. Trigger a bill reminder, medicine reminder, or family reminder push →
   confirm `data.categoryId` is `lifewise_reminder_actions` and (once the
   client-side pieces above are confirmed present) buttons render.
2. Confirm `apns.payload.aps.sound` / `android.notification.sound` is
   `reminder.wav` on those same pushes, `default` on everything else.
3. Send a caregiver-invite push → confirm no `categoryId` in `data`.
4. `POST /api/bills/:id/actions` with `{action:'snooze', days:0,
   minutes:10}` → confirm `snoozedUntil` is ~10 minutes out, not ~1 day.
