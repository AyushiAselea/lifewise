# Bug #15 (Snooze never expires) & Bug #6 (Avatar upload) — Backend Fix Summary (for Frontend team)

**File changed:** `server/routes.ts` (`GET /api/bills` handler)
**No API contract changes** for Bug #15 — response shape is unchanged, values are now correct. No frontend changes required.
**Bug #6 is NOT fixed** — it's blocked on an infra/credentials decision, not code. Details below.

---

## Bug #15 — Fixed and verified live

`GET /api/bills` now reverts any bill whose `snoozedUntil` has passed back to `status: 'active'` before returning the list — and persists that change to the DB (not just patched in the response), so it's fixed for good rather than every request re-computing it.

```ts
// Revert any snooze whose time has passed back to 'active'
await bills.updateMany(
  { userId, status: 'snoozed', snoozedUntil: { $lte: now.toISOString() } },
  { $set: { status: 'active' } }
);
```

Confirmed all three places in the codebase that write `snoozedUntil` do so consistently as ISO strings, so the `$lte` string comparison is safe.

**Live verification performed** (not just code review):
1. Snoozed a real bill (`Electricity Bill`, demo account) for 1 minute via `POST /api/bills/:id/actions {"action":"snooze","minutes":1}` → confirmed `status` became `"snoozed"` immediately.
2. Waited past the 1-minute mark.
3. Called `GET /api/bills` again → confirmed `status` flipped back to `"active"` automatically, with `snoozedUntil` still showing the original (now-past) timestamp for reference.

This directly fixes the reported symptom: a snoozed bill no longer disappears from overdue alerts forever — it reappears once the snooze window is over, next time the user opens/refreshes the app (which calls `GET /api/bills`).

**Not done (optional, flagged in the original bug doc):** a scheduled/cron job that sweeps *all* users' bills periodically so push notifications also re-fire on snooze expiry even if the user hasn't opened the app. The current fix only reverts on-read (i.e. when `GET /api/bills` is called), which is the minimum needed to close the bug as reported. No action needed from frontend either way.

---

## Bug #6 — Root cause confirmed, backend fix blocked on AWS setup

**Frontend fix (already done, no action needed):** the `file://` URI stripping bug in `lib/upload-avatar.ts` is fixed on your side.

**Backend status — confirmed live, not fixed:**

I tested `POST /api/avatar` directly against the running server with a real image file and got:

```json
{"message":"S3 bucket not configured. Set AWS_S3_BUCKET."}
```

This confirms the exact failure mode the bug report predicted. Checked the server's actual `.env` — **`AWS_S3_BUCKET` and `AWS_REGION` are not set**, and neither is documented in `.env.example`. This is an infrastructure/credentials gap, not a code bug — there is nothing further to fix in `server/routes.ts` for this one until an S3 bucket + IAM credentials exist.

**This needs a decision from whoever owns AWS/infra access** (not something I can resolve myself):
1. Create or designate an S3 bucket for avatar storage, with either public-read access on objects or a CDN in front of it.
2. Create IAM credentials with `s3:PutObject` permission for the server process.
3. Set `AWS_S3_BUCKET` and `AWS_REGION` in the server's environment.
4. Once set, re-test `POST /api/avatar` live to confirm it returns a working `https://<bucket>.s3.<region>.amazonaws.com/avatars/...` URL.
5. Add `AWS_S3_BUCKET` / `AWS_REGION` to `.env.example` so this isn't undocumented again.

Until that's done, avatar upload will fail the same way in any environment (dev, staging, prod) that doesn't have these two env vars set — this isn't specific to the local dev server I tested against.

---

## Summary

| Bug | Status | Frontend action needed |
|---|---|---|
| #15 Snooze never expires | **Fixed & live-verified** | None |
| #6 Avatar upload | **Blocked on AWS bucket/credentials setup** — not a code fix | None yet — will confirm once infra is in place and re-tested |
