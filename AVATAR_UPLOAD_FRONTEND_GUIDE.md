# Avatar Upload Fix — Frontend Guide

**Audience:** Frontend team
**Status:** Backend fix is committed, deployed, and verified live against production. No frontend changes are required for the fix itself — this doc exists so you know the new error responses and can decide whether to give them nicer client-side messaging.
**Base URL:** `https://lifewise-backend-5u6n.onrender.com`
**Route:** `POST /api/avatar` (multipart, field name `avatar`), unchanged shape.

---

## 1. What was actually wrong (and what wasn't)

The original bug report for this feature claimed four issues. Before fixing anything, each was checked against the real running server and the real S3 bucket rather than assumed. Two didn't hold up:

- **S3 not configured** — checked: `AWS_S3_BUCKET` / `AWS_REGION` are set and uploads succeed. Not an issue.
- **Missing `ACL: public-read` breaks the returned image URL** — checked: the bucket has a policy that makes objects public regardless of per-object ACL, so URLs already loaded fine even without it. Added the ACL anyway for consistency with the sibling `/api/upload` route and as a safeguard if the bucket policy ever changes, but this wasn't actually broken.

Two were real and are now fixed:

- **No server-side file size limit** — a file of any size would be buffered fully in memory and uploaded. Now capped at 5MB; anything larger is rejected before it reaches S3.
- **No server-side image-type check** — any file type (a `.txt`, a PDF, anything) was previously accepted and saved as a user's `avatarUrl`. Now rejected unless the MIME type starts with `image/`.

---

## 2. New response behavior

Nothing about the success path changed: a valid image under 5MB still returns

```json
{ "url": "https://lifewise-storage.s3.us-east-1.amazonaws.com/avatars/<userId>/<timestamp>-<filename>" }
```
with `201`.

Two new failure responses to handle:

| Condition | Status | Body |
|---|---|---|
| File is not an image (MIME type doesn't start with `image/`) | `400` | `{ "message": "Only image files are allowed." }` |
| File exceeds 5MB | `400` | `{ "message": "Avatar image must be 5MB or smaller." }` |

Both are `400`s with a `message` string, same error shape you already handle elsewhere — no new parsing logic needed. If `lib/upload-avatar.ts` already surfaces `message` from a failed response (per the existing hardening work noted in the original bug doc), these will show up automatically with no code changes.

Since the client-side 5MB check and image-picker file type already exist on your side per the earlier hardening pass, these backend responses should rarely trigger in normal use — they're a backstop against someone calling the API directly or a client-side check being bypassed. If you want tighter parity, the exact same 5MB threshold is enforced server-side, so no mismatch to worry about.

---

## 3. Nothing else changes

- Request shape: unchanged (`multipart/form-data`, field `avatar`).
- Success shape: unchanged (`{ url }`, `201`).
- The follow-up `PUT /api/auth/me` with `{ avatarUrl: url }` save step: unchanged, unaffected.
- Upload timeout, MIME-type guessing for `.png`/`.webp`/`.jpg` on your side, revert-on-failure behavior, loading spinner — all still valid, no changes needed.

---

## 4. Verified live (production)

Run against `https://lifewise-backend-5u6n.onrender.com` with a real account and a real S3 bucket:

1. Valid small PNG → `201`, returned URL loads directly in a browser as a real image.
2. Non-image file (`.txt`) sent as the `avatar` field → `400 "Only image files are allowed."` (previously would have silently succeeded and been saved as the user's avatar).
3. 6MB file sent as an image → `400 "Avatar image must be 5MB or smaller."` (previously returned a raw `500 "File too large"` with no clean message).
4. Full flow: upload → save via `PUT /api/auth/me` → `GET /api/auth/me` reflects the new `avatarUrl`.

No regressions found on the sibling `/api/upload` route (family member avatars, receipt scanning, etc.) — it uses a separate upload configuration and was not touched by this fix.
