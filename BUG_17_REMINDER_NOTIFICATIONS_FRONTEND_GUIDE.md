# Bug #17 — Reminder Notifications Not Delivered + Wrong App Icon

**Audience:** Frontend team
**Reported by:** Client, 2026-08-07 (screenshots showing two different icons for the same app)
**Status:** ✅ Fixed. **Backend-only.** No app rebuild or store release required for this fix.
**Files changed:** `server/routes.ts`, `server/push.ts`

---

## 0. TL;DR

Two separate bugs, both server-side:

1. **"3 days before" / "1 day before" bill reminders almost never fired.** Only same-day
   reminders (`daysLeft === 0`) were actually reaching users — the scheduler discarded
   everything else. This is what the client meant by "reminders are not coming."
2. **Push notifications rendered the wrong icon.** The FCM payload never named the app's
   icon drawable, so Android fell back to its own default when a notification arrived while
   the app was backgrounded — a different logo than the one local (in-app scheduled)
   notifications show. That's the two-different-icons screenshot.

Nothing in the app needs to change for either fix. Confirmed via `tsc --noEmit` and an
`esbuild` production bundle — both clean on the touched files.

---

## 1. Bug 1 — Advance reminders now actually fire

### What was wrong

The scheduler ran every 60 seconds and only queued a reminder if the bill's exact due
timestamp fell inside a 5-minute lookahead window. For a bill due in 3 days, that's never
true, so the `[3, 1, 0]` reminder schedule silently behaved as `[0]` — only the due-day
reminder ever sent.

### What changed

Same-day reminders (`daysLeft === 0`) still fire near the actual due time, unchanged.
Advance reminders (`daysLeft > 0`) now fire once per day at a fixed **send hour** —
currently **09:00 server local time** — instead of depending on the due timestamp landing
in a 5-minute window. The existing dedup on `reminder_logs` (`userId, billId, channel,
dayOffset`) still guarantees exactly one send per bill per day-offset, so this can't produce
duplicates.

**Also fixed as part of the same change:** if the server was down/restarting at the moment a
reminder should have fired, it now catches up (same-day reminders catch up immediately;
advance reminders catch up later the same day, still gated by the send hour). Previously a
reminder due during a restart was lost permanently.

### Does this affect the app?

No visible contract change — reminders still arrive as push + in-app notifications with the
same payload shape as before. The only observable difference is **reminders you weren't
getting before will now show up**, at a predictable time of day instead of never.

**Open decision, not blocking:** the send hour is currently server time for all users, not
per-user timezone. If reminders should respect each user's local time zone, that requires
the server to know each user's timezone — flag it if this matters; it's a follow-up, not
part of this fix.

---

## 2. Bug 4/5 — Correct app icon, no more random image

### What was wrong

- The FCM payload never set `android.notification.icon`, so when a notification arrived
  while the app was backgrounded, Android rendered its own default icon instead of the
  app's `notification_icon` drawable. Local notifications (scheduled by the app itself) were
  always correct because they don't go through this path — that's exactly why the client's
  screenshots showed two different logos for the same app.
- Every reminder also attached a random abstract shape from `api.dicebear.com` as the
  notification's image — not the app logo, and it made rendering depend on a third-party
  service being reachable.

### What changed

Every server push notification that has visible text (title/body) now explicitly sets:

```json
{
  "android": {
    "notification": {
      "icon": "notification_icon",
      "color": "#4F46E5",
      "channelId": "default"
    }
  }
}
```

This matches the drawables and manifest registration you already ship
(`android/app/src/main/res/drawable-*/notification_icon.png`,
`AndroidManifest.xml`, `res/values/colors.xml`). The dicebear fallback image was removed —
a reminder now only includes an `imageUrl` if the underlying record (e.g. a scanned bill)
actually has a real uploaded image; otherwise no image is sent at all.

This is centralized in `server/push.ts`, so it applies to every server-sent push: bill
reminders, medicine doses, family reminders, caregiver invites/accepts.

### Does this affect the app?

No. Nothing in `lib/notifications.ts` or the notification channel setup needs to change —
the fix only makes the server payload match the icon/channel names the app already
registers.

---

## 3. What was already fixed (earlier work, confirmed still in place)

These were flagged in the original backend bug report but turned out to already be handled
by prior work (see `PUSH_NOTIFICATIONS_FRONTEND_GUIDE.md`) — re-verified while working on
this bug, no new changes needed:

- **FCM send failures are logged with per-token error codes**, not silently reported as
  success (`server/push.ts`).
- **Dead tokens are pruned automatically** on the three permanent FCM error codes
  (`registration-token-not-registered`, `invalid-registration-token`, `invalid-argument`).
- **`channelId` is honored** in the payload (currently hardcoded to `'default'` everywhere —
  see the open item below).
- **`tokenType` sent by `POST /api/push-token`** is read and persisted; Expo-format tokens
  (`ExponentPushToken[...]`) are rejected outright at registration instead of being stored
  and silently failing later.

---

## 4. Still open (not part of this fix, not blocking)

- **Per-user sound/vibration channel selection.** The server always uses the `'default'`
  Android channel (sound + vibration) for reminder pushes. Your four client-side channels
  (`default`, `reminders_novibrate`, `reminders_silent`, `reminders_silent_novibrate`) exist
  and are registered correctly on-device, but the server doesn't know which one a given user
  picked — that preference currently lives only in AsyncStorage
  (`@lifewise_reminder_settings`). If server pushes should honor it, the app would need to
  sync that setting to the server (e.g. alongside `POST /api/push-token`). This is the one
  item that would need a frontend change, and it's optional — flag it if you want it
  prioritized.
- **Per-user timezone for the advance-reminder send hour** (see §1).

---

## 5. What to verify on your side

Nothing is required, but if you want to confirm end-to-end:

1. Create a bill due in 3 days with `reminderDaysBefore: [3, 1, 0]`. At 09:00 server time you
   should see a reminder arrive — previously none would have.
2. Trigger any reminder push with the app fully closed and compare its icon against a local
   (in-app scheduled) notification for the same bill — they should now match.
3. No dicebear/random image should appear on any reminder push.
