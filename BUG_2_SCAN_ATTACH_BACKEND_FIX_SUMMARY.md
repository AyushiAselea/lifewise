# Bug #2 (Attach Scan photo never saves) — Backend Fix Summary (for Frontend team)

**File changed:** `server/routes.ts` (`PUT /api/bills/:id` handler)
**No API contract changes** — response shape is unchanged. No frontend changes required; your existing `PUT` call (spreading `editingData` including `imageUrl`/`imageKey`) will now actually persist.

---

## What was wrong

`PUT /api/bills/:id` whitelists which fields it writes to the DB, and `imageUrl` / `imageKey` were missing from that whitelist. The request always returned `200 { ok: true }`, so the app had no way to know the fields were silently dropped — the scan/upload/OCR pipeline worked correctly end-to-end, but the final "attach to existing bill" step discarded the photo URL.

## The fix

Added two lines to the field whitelist in `PUT /api/bills/:id`:

```ts
if (body.imageUrl !== undefined) update.imageUrl = body.imageUrl;
if (body.imageKey !== undefined) update.imageKey = body.imageKey;
```

No schema migration needed — `imageUrl`/`imageKey` were already valid fields on the `bills` collection (correctly written by `POST /api/bills/scan/commit` when creating a brand-new bill). This bug only affected attaching a scan to an **existing** bill via `PUT`.

## Live verification performed

1. Picked a demo-account bill (`Electricity Bill`) with no `imageUrl` set.
2. Called `PUT /api/bills/<id>` with `{"imageUrl": "https://example-bucket.s3.amazonaws.com/test.jpg", "imageKey": "bills/test/test.jpg"}`.
3. Called `GET /api/bills` afterward — confirmed both fields are now present and correctly persisted on that bill.

This matches the exact verification steps in the original bug report. The server was restarted to pick up the change and the fix is live.

## What this means for you

Nothing needs to change on the frontend — `scan-bill.tsx`'s existing `PUT` call was already sending the right data. Once you pick up this backend change, the "Attach Official Bill Scan" flow should work end-to-end: scan a bill on an existing reminder → return to Bill Detail → it now shows the attached photo instead of "Digital Summary Available."
