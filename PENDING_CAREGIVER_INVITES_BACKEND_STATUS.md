# Pending Caregiver Invites — Backend Status

**Audience:** Frontend team
**Date:** 2026-08-20
**Source doc:** `Pending Caregiver Invites — Backend Requirements` (2026-08-19)

Done. `GET /api/family/:memberId/connected-caregivers/invites` is live —
per your doc, no client release needed.

---

## What was built

Exactly the endpoint specified, reusing the existing `CaregiverInvite`
serializer rather than writing a second one (factored the inline mapping
out of `GET /api/caregiver-invites` into a shared `serializeCaregiverInvite`
function, used by both routes — so the two directions genuinely can't
drift in shape over time, not just today).

```
GET /api/family/:memberId/connected-caregivers/invites
Auth: required. OWNER ONLY (403 for anyone else, including a connected caregiver).

200 → CaregiverInvite[], status: "pending" only, [] when none
403 → requester is not the owner
404 → :memberId doesn't exist
```

Query is `caregiverInvites.find({ memberId: member._id, status: 'pending' })`
— filters server-side as your doc required, not relying on the client's
defensive filter.

---

## Verified live, not just read

Ran your exact §5 sequence against a running server:

1. Owner invites `pending-caregiver-test@example.com` for member "Papa
   Test" → `201`.
2. `GET .../connected-caregivers/invites` as owner → one row,
   `status: "pending"`, correct `inviteeEmail`, matching the shape in
   your doc byte-for-byte.
3. The invitee (non-owner, not yet connected) calling the same endpoint
   → `403`, confirmed **before** they'd accepted (the stricter case —
   owner-only, not "connected-users-only").
4. Invitee accepts.
5. `GET .../invites` afterward → `[]`. `GET .../connected-caregivers`
   afterward → the caregiver now appears there. Never both at once.
6. Nonexistent `:memberId` → `404`. No auth header → `401`.

All six matched spec.

---

## §6 — the two related items

**Invite email**: confirmed wired, not just templated. `POST
.../connected-caregivers/invite` calls `sendReminderEmail()` with
`renderCaregiverInviteEmailTemplate()`'s output on every invite creation
— this was already true before today, not something added for this doc.
So "Pending" should not be permanent for someone not told out-of-band,
assuming the mail provider itself is configured and delivering (that's
outside what a code read can confirm — if invitees report never getting
the email, that's a deliverability question, not a wiring gap).

**Revoke an invite**: not built, as you flagged it wasn't requested.
Noting for whenever it's prioritized: the natural shape is `DELETE
/api/family/:memberId/connected-caregivers/invites/:inviteId`,
owner-only, setting the invite's `status` to something other than
`pending` (or deleting the document) rather than a hard delete, mirroring
how accept/decline already work. Say the word when you want it.

---

## Note on §7 of your doc

Checked before doing anything else: `grep -c "connected-caregivers"
server/routes.ts` returns `4` matches in this checkout right now, and
`origin/main` matches local exactly (`git log` on both lines up). The
"grepping returns nothing" claim doesn't hold for `main` as of today —
not disputing your deployed-API probing methodology, which is sound and
which I used the same way to verify this endpoint before writing this
doc, just flagging that whatever was stale wasn't this branch.
