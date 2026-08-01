# Push Notifications — Backend Fixes, Frontend Integration Guide

**Audience:** Frontend team
**Status:** ✅ **Push notifications are live.** All backend-side fixes from `Push Notifications — Backend Requirements` (2026-08-01) are implemented, and the credential blocker described in the original version of this doc (§0) has been resolved — a fresh Firebase service account key was generated and installed, and the fix was re-verified end-to-end.
**Verification:** Live-tested against the real database and the real Firebase project, before and after the credential swap, so the before/after comparison in §0 is a genuine A/B, not an assumption.

---

## 0. The credential blocker — found, and now fixed

While verifying the Expo-token fix (§1) with a real send, a second, independent problem was found: **the backend's Firebase service account credential could not authenticate with Google at all**, for any request — unrelated to the Expo/FCM token mismatch, and it would have blocked push even with a perfect native FCM token.

Confirmed at the time with three independent checks (system clock was accurate; hand-built the JWT with a different library and sent it directly to Google's OAuth2 endpoint, still rejected; the private key file itself was not corrupted, it correctly self-verified offline) — all pointing to the key having been revoked or rotated in the Firebase console after the old `server/firebase-service-account.json` was generated.

**A fresh service account key has since been generated and installed.** Re-tested with the same method used to diagnose the original failure:

| | Old key | New key |
|---|---|---|
| Direct JWT exchange with Google's OAuth2 endpoint | `400 invalid_grant: Invalid JWT Signature` | `200`, real access token returned |
| Real send attempt (fake test token) | `app/invalid-credential` — rejected before even checking the token | `messaging/invalid-argument: The registration token is not a valid FCM registration token` — **Google authenticated the request and evaluated the token**, correctly rejecting it for being fake |
| Dead-token pruning (§2) | Never ran — nothing got past the auth failure | Ran correctly — the fake token was pruned from `push_tokens` after being rejected |

The error changing from an auth-level rejection to a token-level rejection is the proof: the credential itself works now. A real device's FCM token would go through cleanly where my synthetic test string correctly did not.

**What this means for you:** nothing below is theoretical or "ready but inert" anymore — it's live. The only thing that still can't be verified from this side is actual delivery to a physical device, since that requires a real FCM/APNs token from a running app instance.

---

## 1. §4.1 — Expo tokens purged, new registrations validated

**Verified live against the real database:** 19 of 20 stored tokens were in `ExponentPushToken[...]` format — completely unusable by FCM, confirmed via direct query before running the cleanup. Ran a one-time purge; only the one legitimate token remained afterward.

`POST /api/push-token` now:
- Rejects any token starting with `ExponentPushToken[` with `400 Expected a native FCM/APNs token, not an Expo push token.` — verified live.
- Accepts an optional `tokenType` field (defaults to `"fcm"` if omitted) — this is what lets us tell a live FCM row from anything stale in the future.

**No client code change is required for this specific fix** — you already switched to `getDevicePushTokenAsync()` per your own §3.1, which returns a native token. This just makes the server actively reject the old format instead of silently storing something that could never work, and gives us a field to audit against later.

---

## 2. §4.2 — every push send now reads its own result and prunes dead tokens

All 8 places in the backend that call FCM (bill reminders, medicine doses, family reminders, caregiver invites, caregiver-accept, medicine sync, emergency alerts) now go through one shared function (`server/push.ts`) instead of each duplicating the same call.

**Observable behavior, confirmed live now that §0 is fixed:**
- The old log line `[Push] Multi-device send to N tokens for user X` is gone — it printed on every attempt regardless of outcome, which is exactly how a 100%-failure state went unnoticed. It's replaced with `[Push] sent=X failed=Y`, which reflects what FCM actually reported.
- A token FCM permanently rejects (invalid, unregistered — e.g. after an uninstall) is now automatically deleted from `push_tokens` — verified live post-fix: a fake token was correctly pruned after Google evaluated and rejected it.
- A credential-level failure (like §0, before the fix) does **not** trigger pruning — only genuine per-token rejections do. This was checked deliberately, since incorrectly pruning on an auth failure would have wiped every legitimate token the moment the credential broke.

**Nothing required on your side for this.**

---

## 3. Two payload bugs fixed along the way — relevant to your tap-routing table

While consolidating the 8 send sites into one function, two mismatches against your own §3.3/§5.4 contract were found and fixed:

### 3.1 Medicine dose push was missing `memberId`/`medId`

Your doc states these are required, not optional, for the medicine tap-routing case. The payload previously sent only `{ type: 'medication', route }`. Now sends:

```json
{ "type": "medication", "memberId": "665a…", "medId": "med_17…", "route": "/medicine-details/665a…/med_17…" }
```

### 3.2 Family reminder push used the wrong `type`/field name

Previously sent `type: 'family'` with a field called `kind` for the source kind. Your §3.3 table expects `type: 'family-reminder'` with the field named `sourceKind` (matching what `makeFamilyReminderId` needs to rebuild the composite id). This was a real bug — tapping a family reminder push would not have matched any case in your routing table and fallen through to the generic `/notifications` screen instead of the record detail. Now sends:

```json
{
  "type": "family-reminder",
  "memberId": "665a…",
  "sourceKind": "appointment",
  "sourceId": "apt_17…",
  "route": "/family-reminder/fam:appointment:665a…:apt_17…"
}
```

Also fixed the in-app notification's `meta` object (what `GET /api/notifications` returns) to match the same shape, so a tap from the Notifications screen and a tap from a push behave identically.

### 3.3 Also fixed, not client-visible

`android.notification.priority` was nested one level too deep in the FCM payload (should be `android.priority`, not `android.notification.priority`) — FCM silently ignores a `priority` in the wrong place rather than erroring, so this was a real defect that never surfaced as a visible error. Corrected in the shared helper.

---

## 4. §4.4, point 1 — unique index already existed, no action needed

Checked `reminder_logs` — the unique index on `(userId, billId, channel, dayOffset)` your doc asks for in §4.4 point 1 was already in place from earlier work. Multi-instance duplicate pushes are already structurally prevented; nothing changed here. Points 2-3 (bounded query, real job runner) are listed as still open in §5.

---

## 5. What's still open from your original doc

Nothing below is blocked by the credential anymore — these are just the parts of the original spec not addressed in this pass:

- **§4.3** — recording push outcome (`sent`/`failed`) on the `reminder_logs` row itself, for diagnosability. Not done this pass.
- **§4.4, points 2-3** — bounding the reminder scheduler's query by due date, and moving off a bare `setInterval` to a real job runner. Point 1 (the unique index) was already in place and is confirmed working.
- **§4.5** — honoring sound/vibration preference per user via `channelId` selection. The shared helper accepts a `channelId` parameter and defaults to `'default'` everywhere it's called; wiring it up to read the user's actual `reminderSettings` wasn't done this pass.
- **§6 / §7** — Family Hub non-medicine reminder coverage and caregiver fan-out are largely already built from earlier work (see `FAMILY_REMINDERS_FRONTEND_GUIDE.md` and `FAMILY_RECORDS_CAREGIVER_SHARING_VERIFIED.md`) — the cutover-ordering warning in your §6 still applies exactly as you described it, and is worth re-reading before flipping anything.

---

## 6. What to do next on your side

The backend is ready — the remaining verification needs a real device, which is outside what can be done from here:

1. Build a dev client (`npx expo run:android` / `run:ios` — `expo-notifications` does not run in Expo Go).
2. Register a real device, confirm `POST /api/push-token` stores a native token and `GET` on `push_tokens` (or just trust the 200 response) shows no `ExponentPushToken[` prefix.
3. Trigger any of the flows in §3 (a bill reminder, a medicine dose, a caregiver invite) and confirm the push actually arrives with the app fully closed.
4. Tap it and confirm it opens the right screen, per the payload shapes in §3.
5. Then work through the rest of your original doc's §8 device checklist (uninstall-prunes-token, sound/vibration preference, Family Hub coverage) as those pieces land.

If a real send still doesn't arrive after all of the above, that's a new finding — the credential and token-handling layers are now confirmed working, so a further failure would point somewhere else (device-side permission state, a channel ID mismatch, or a FCM project configuration issue specific to that device's app instance).
