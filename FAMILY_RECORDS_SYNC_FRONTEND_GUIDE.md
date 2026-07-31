# Family Hub Records — Server Persistence, Frontend Integration Guide

**Audience:** Frontend team
**Status:** The 3 gaps identified in `FAMILY_RECORDS_SERVER_PERSISTENCE.md` (§3.2, §3.3, §5, §6) are fixed, committed, and pushed to `main` (`e01ff36`).
**Verification:** Every behavior below was exercised live against the real MongoDB Atlas instance with a disposable test user/member (registered, tested, deleted).

---

## 0. TL;DR

| Spec section | Ask | Status |
|---|---|---|
| §3.1 field shapes | Match `lib/family-records.ts` interfaces exactly | Unaffected — routes are already generic pass-through, no reshaping happens |
| §3.2 PATCH merges, `id`/`createdAt` immutable | Merge already existed; immutability was missing | **Fixed** |
| §3.3 keep client-generated ids | POST always generated a server id | **Fixed** |
| §3.4 caregiver access | — | Already working (see the Family Hub Reminders guide) |
| §4 cascade delete on member removal | — | Already working — records live as array fields on the member document |
| §5 idempotent upload | POST always appended, never upserted | **Fixed** |
| §6 conflict resolution (last-write-wins) | No `updated_at` comparison existed | **Fixed** |
| §7 no server-side computation here | — | Unaffected — this endpoint remains verbatim storage |

**Route paths did not change.** The original spec proposed
`/api/family/:memberId/records/:kind`; what's live and what stays live is the
existing `/api/family/:memberId/<kind>` per-feature routes (`/appointments`,
`/familyBills`, `/medicationStock`, `/checkins`, `/travelItems`, etc. — the
same ones the reminders projection already reads from). If you're already
calling these, nothing about the URL shape changes. If you were planning to
build against `/records/:kind`, flag it before starting — that path does not
exist.

---

## 1. POST now accepts and preserves your client-generated id

Every record you create locally already has an id shaped like
`1785496194477-xdopnzqng` (`Date.now() + random suffix`). Send it.

```
POST /api/family/:memberId/appointments
Authorization: Bearer <token>
Content-Type: application/json

{ "id": "1785496194477-xdopnzqng", "doctorName": "Dr. Mehta", "date": "2026-08-04T10:30:00.000Z" }
```

```json
{ "id": "1785496194477-xdopnzqng", "doctorName": "Dr. Mehta", "date": "2026-08-04T10:30:00.000Z", "createdAt": "2026-07-31T12:42:39.309Z" }
```

- The `id` you send comes back unchanged — verified live.
- **Omitting `id` still works exactly as before**, generating a server id —
  nothing breaks if some call site doesn't send one yet.
- This is what keeps `sourceId` stable in `GET /api/reminders/family`
  (`fam:<kind>:<memberId>:<sourceId>`). Verified live: a record posted with a
  client id shows up in the reminders projection using that exact id — no
  remapping, no orphaned reminders.

**Action for you:** when uploading existing local records (the migration in
§5 below), always send the existing `id`. For newly-created records going
forward, keep doing whatever you do today — sending your generated id is
correct either way.

---

## 2. POST is now idempotent — safe to retry, safe to upload from two devices

```
POST /api/family/:memberId/appointments   { "id": "X", "doctorName": "Dr. A" }
→ 201, record created

POST /api/family/:memberId/appointments   { "id": "X", "doctorName": "Dr. A", "notes": "bring reports" }
→ 200, existing record merged in place — still exactly one record
```

Verified live: posting the same `id` twice in a row leaves exactly one item
in the array, `createdAt` stays pinned to the *first* insert, and the second
POST's fields merge onto the first (same merge semantics as PATCH, below).

**HTTP status tells you which happened:** `201` = new record created, `200`
= an existing record with that id was found and merged. Useful if you want
to log/debug the upload step, not required for correctness — both are
success.

**Action for you:** the one-time upload of existing local records on first
launch after the update (spec §5, step 1) can now safely `POST` every local
record, retry on network failure without checking first whether it already
went through, and run from two devices that happen to have the same record
— none of that produces duplicates.

---

## 3. `id` and `createdAt` cannot be overwritten, on POST or PATCH

Sending `id` or `createdAt` in a PATCH body (or in a POST body for a record
that already exists) is silently ignored — the stored values win. Verified
live on both routes: a PATCH attempting `{"id": "HACKED", "createdAt": "1999-01-01..."}`
left both fields exactly as they were before.

You don't need to strip these fields client-side before sending a patch —
sending your full local object (including its own `id`/`createdAt`) is fine
and does nothing unexpected.

---

## 4. PATCH now supports last-write-wins via `updatedAt`

```
PATCH /api/family/:memberId/appointments/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "notes": "bring reports", "updatedAt": "2026-07-31T12:44:12.672Z" }
```

- **If you send `updatedAt`** and it's *older* than what the server has
  stored for that record, the patch is a no-op — the server's current
  version is returned unchanged, your edit is dropped. This is the
  conflict-resolution rule from the original spec's §6: two devices editing
  offline, the later timestamp wins.
- **If you omit `updatedAt`**, the patch always applies — matches today's
  client behavior exactly, so nothing breaks if you don't send it yet.
- On success, the server sets `updatedAt` to its own clock time in the
  response — use the response's `updatedAt`, not a value you computed
  locally, going forward.

Verified live: a patch with a 2020 timestamp was correctly rejected against
a record already updated at a later time; a patch with a future timestamp
correctly applied.

**Action for you:** once you have a local edit timestamp available, send it
as `updatedAt` on every `PATCH`. Until then, omitting it is safe — you just
don't get conflict protection yet, same as before this change shipped.

**One thing to confirm from your side:** the original spec's §3.4 flagged
that completion state must be a property of the record, not the viewer — if
the owner completes an appointment, the caregiver's view should show it
complete too, since there's only one row. That was already true before this
change (single array field on the member document) and remains true — no
per-user completion state exists anywhere in this data model.

---

## 5. Migration sequence — unchanged from the original spec, now unblocked

The 3-step sequence in the original spec's §5 needed exactly the two fixes
above to be safe:

1. **Client uploads first** — now safe to do unconditionally, id-preserving,
   idempotent (§1, §2 above).
2. **Server accepts idempotently** — done (§2).
3. **Client reads from server**, local storage as offline cache — this part
   is entirely on your side; no further backend change needed to start it.

Nothing else in the original spec's §3/§4/§7 needed backend changes — field
shapes were already pass-through (no reshaping to break), caregiver access
and cascade-delete were already correct, and the reminder projection already
reads from these same records rather than keeping its own copy.

---

## 6. What to test on your side before flipping the migration on

- Upload a record with a known local `id`, confirm the response `id` matches
  before writing anything to local "synced" state.
- Re-run the same upload (simulate a retry / app restart mid-upload) and
  confirm no duplicate appears in `GET /api/family/:memberId/<kind>`.
- Edit the same record from two simulated "devices" with different
  `updatedAt` values, confirm the earlier one is silently dropped rather
  than overwriting the later one.
