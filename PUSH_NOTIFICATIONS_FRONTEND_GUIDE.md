# Push Notifications — Backend Fixes, Frontend Integration Guide

**Audience:** Frontend team
**Status:** The backend-side fixes from `Push Notifications — Backend Requirements` (2026-08-01) are implemented and live-verified in code. **Push still cannot be delivered end-to-end** — a second, more fundamental problem was found that blocks everything regardless of the token-type fix. See §0.
**Verification:** Live-tested against the real database (19 dead tokens purged, confirmed via direct query) and the real Firebase project. Not committed/pushed yet — ask before assuming this is deployed.

---

## 0. Read this first — push does not work yet, for a bigger reason than the token bug

The original bug report (Expo tokens sent to FCM, which rejects them) is real and is fixed on the backend side (§1). But while verifying the fix with a real send, a second, independent problem surfaced:

**The backend's Firebase service account credential cannot authenticate with Google at all**, for any request. This is not related to the Expo/FCM token mismatch — it would block push even with a perfect native FCM token.

Confirmed with three independent checks, not just a single failed send:
1. System clock is accurate (ruled out clock skew, a common cause of this exact error).
2. Bypassed `firebase-admin` entirely — hand-built the JWT with a different library and sent it directly to Google's OAuth2 endpoint. Still rejected: `invalid_grant: Invalid JWT Signature`.
3. The private key file itself is *not* corrupted — it correctly signs and self-verifies offline. Google specifically doesn't recognize it, which points to the key having been revoked or rotated in the Firebase console after `server/firebase-service-account.json` was generated (dated 2026-07-10).

**This needs someone with Firebase console access to generate a fresh service account key and replace the file — it's not fixable from application code on either side.** Until that happens, no push will be delivered no matter what token type the client sends. Everything below is correct and ready, but inert until the credential is replaced.

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

**What changed in observable behavior once the credential issue (§0) is fixed:**
- The old log line `[Push] Multi-device send to N tokens for user X` is gone — it printed on every attempt regardless of outcome, which is exactly how a 100%-failure state went unnoticed. It's replaced with `[Push] sent=X failed=Y`, which reflects what FCM actually reported.
- A token FCM permanently rejects (invalid, unregistered — e.g. after an uninstall) is now automatically deleted from `push_tokens`. Previously dead tokens stayed forever and kept "succeeding" in the misleading log.
- Verified live: sent to a token, got back `[Push] sent=0 failed=1` with the real FCM error code logged per-token — proving the result is actually being read now, not discarded.

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

## 4. §4.4 — unique index already existed, no action needed

Checked `reminder_logs` — the unique index on `(userId, billId, channel, dayOffset)` your doc asks for in §4.4 point 1 was already in place from earlier work. Multi-instance duplicate pushes are already structurally prevented; nothing changed here.

The bounded-query and real-job-runner parts of §4.4 (points 2-3) were **not** addressed in this pass — flagging as still open if you want them prioritized.

---

## 5. What's still open from your original doc

- **§4.3** — recording push outcome (`sent`/`failed`) on the `reminder_logs` row itself, for diagnosability. Not done this pass.
- **§4.5** — honoring sound/vibration preference per user via `channelId` selection. The shared helper accepts a `channelId` parameter and defaults to `'default'` everywhere it's called; wiring it up to read the user's actual `reminderSettings` wasn't done this pass.
- **§6 / §7** — Family Hub non-medicine reminder coverage and caregiver fan-out are largely already built from earlier work (see `FAMILY_REMINDERS_FRONTEND_GUIDE.md` and `FAMILY_RECORDS_CAREGIVER_SHARING_VERIFIED.md`) — the cutover-ordering warning in your §6 still applies exactly as you described it, and is worth re-reading before flipping anything.
- **§8 acceptance criteria requiring a physical device** — none of these can be verified from here (no dev build, no physical device in this environment). Everything in this document was verified at the API/code level, not on-device. Please run the device-level checklist from your original §8 once the credential in §0 is replaced.

---

## 6. Suggested order once someone replaces the Firebase credential

1. Generate a fresh service account key from the Firebase console for project `lifewise-6e740`, replace `server/firebase-service-account.json`.
2. Re-run the smoke test from your original doc's §8 (`sendEachForMulticast` to one known-good real device token, print `responses`).
3. If that succeeds, everything in §1–§3 above should now work end-to-end with no further backend change.
4. Then work through your own §8 device checklist for real delivery, tap-routing, and the sound/vibration and Family Hub coverage items still open in §5.
