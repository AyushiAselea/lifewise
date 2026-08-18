# Caregiver Permissions & Scoped Access — Backend Status

**Audience:** Frontend team
**Date:** 2026-08-17
**Source doc:** `Caregiver Permissions & Scoped Access — Backend Requirements` (2026-08-17)

Status against that doc's TL;DR table: **everything is implemented**, §1
through §7.

| # | Work | Status |
|---|---|---|
| 1 | Store `permissions` on each caregiver entry (§2) | ✅ Done |
| 2 | Return `permissions` from `GET .../connected-caregivers` (§3) | ✅ Done |
| 3 | Accept `permissions` on the invite call (§4) | ✅ Done |
| 4 | New `PATCH .../permissions` route (§5) | ✅ Done |
| 5 | Enforce on every read/write (§6) | ✅ Done |
| 6 | Scope reminders/push to permitted modules (§7) | ✅ Done |

New file: `server/family-permissions.ts` — the model, validators, and the
`:kind` → module-key / `sourceKind` → module-key maps, shared by every route
below rather than duplicated per-route.

---

## §1–§2: the model, stored as specified

`allowedModules: FamilyFeatureKey[] | null` and
`accessLevel: 'view' | 'mark_done' | 'full'`, stored on each
`family_members.caregivers[]` entry and on `caregiver_invites`, exactly as
specified. **No migration was run or needed** — existing caregiver entries
simply have no `permissions` field, and every enforcement check treats
absent/null as full access. Verified directly: a caregiver with no
`permissions` object is unaffected by any of this work.

## §3: `GET .../connected-caregivers`

Owner rows never carry `permissions`. Caregiver rows include it only when the
owner has actually stored a restriction — a legacy or never-restricted
caregiver still gets no `permissions` key, matching the client's
absent-means-full normalization.

## §4: `POST .../connected-caregivers/invite`

Accepts an optional `permissions` body field, validated before anything is
written: an unrecognized module key or access level returns `400`, never
silently stored or interpreted as "allow." Stored on the invite; copied onto
the `connectedCaregivers` entry when the invite is accepted.

## §5: `PATCH /api/family/:memberId/connected-caregivers/:caregiverUserId/permissions`

New route, exactly as specified: `200` on success, `400` on an invalid
module/level, `403` for anyone but the member's owner (**including the
caregiver whose own permissions are being changed** — a caregiver cannot
widen their own access by calling this on themselves), `404` if the member
or caregiver isn't found.

---

## §6: Enforcement — where it actually lives

Two helpers in `server/routes.ts` do the gating:

- `resolveRequesterPermissions(member, requesterId)` — the owner always
  resolves to unrestricted `full`; a caregiver resolves to their stored
  `permissions`, normalized (absent/null → full).
- Every route then calls `canAccessModule(permissions, moduleKey)` for reads
  and `hasAccessLevel(permissions, requiredLevel)` for writes, returning
  `403` on failure.

**Coverage — every route the doc's §6.1 table and §9 verification steps
name:**

- All 21 kinds under `registerFamilyArrayFeature` (the 12 original + 9 added
  for the previously-missing PRD modules) — `GET`/`POST`/`PATCH`/`DELETE`
  all gated. `GET` needs `view`, `POST`/`DELETE` always need `full`, `PATCH`
  needs `mark_done` **only** when the patch body touches nothing but a
  completion/snooze field (`isPaid`, `completed`, `taken`, `lastDoneAt`,
  `completedDates`, `snoozedUntil`, `status`, and — new, not in the source
  doc's list but the same category — `acknowledged`, used by
  `emergencyLog`); any other field in the same patch requires `full`.
- `PATCH .../medicationStock/:itemId/adjust-stock` — module `stock`, `full`
  (adjusting a quantity isn't a completion toggle).
- `GET`/`PUT /emergency-settings` — module `emergency`, `PUT` needs `full`.
- `GET /emergency-log` + `PATCH /emergency-log/:itemId` — module
  `emergency`, `PATCH` needs `mark_done` only for an `acknowledged`-only
  patch, `full` otherwise.
- `GET`/`PUT /custom-config` — module `custom`, `PUT` needs `full`.
- `PATCH /api/family/:memberId/medicines/:medId` (taken/snooze/skip) —
  module `medicines`, `mark_done` (this route never edits the medicine's own
  fields, only completion state, so `mark_done` is always sufficient).
- `GET /api/family/shared-with-me` — §6.3's "consider returning only
  permitted modules in `features`" is done, not just considered: a
  restricted caregiver's `features` object is filtered down to their
  `allowedModules` before it reaches the client.

**One pre-existing gap this doc doesn't create and I didn't expand**:
`POST /api/family/:id/medicines` (creating a new medicine) is, and remains,
owner-only — it queries `{ userId: requesterId }` directly and has no
caregiver path at all today. §6.2's table implies a `full`-level caregiver
should be able to create one; that's not true yet, for anyone, regardless of
permissions. Opening that up would be a separate, real behavior change (it
currently blocks ALL caregivers, not just under-permissioned ones), so I left
it as-is rather than fold it into a permissions PR. Flagging it in case it
matters for the caregiver flow you're building against.

---

## §7: Reminders and push

- `GET /api/reminders/family` — rows are filtered by the requester's
  `allowedModules` per member before the response is sent (mapped via each
  row's `sourceKind`).
- Push fan-out for both the Family Hub reminder scheduler and the medicine
  dose scheduler now excludes any caregiver not permitted to see that
  module, **before** anything is logged or sent (not filtered after the
  fact).
- Snooze/Done action buttons: within a single reminder's push, recipients
  are split into two groups — `mark_done`+ caregivers get the buttons
  (`categoryId` set), `view`-only caregivers get the same notification with
  no buttons. Belt-and-braces: even if a client somehow rendered a button
  for a `view`-level caregiver, tapping Done calls the same `PATCH`
  route already gated in §6 and gets `403`.

---

## How to verify

Ran the exact model logic (not the live HTTP routes — see note below)
against `server/family-permissions.ts` directly: legacy/absent permissions
resolve to full access, module scoping and access-level ranking behave as
specified, invalid module/level input is rejected rather than silently
accepted, and mark-done-only vs. full-edit patch detection matches the
doc's field list. All checks passed.

**Not run**: the doc's §9 end-to-end HTTP steps (actual `POST`/`GET`/`PATCH`
calls against a running server with a real invite/accept flow). A dev server
was already running on the configured port during this work and I didn't
want to bounce it out from under whoever has it up — recommend running
through §9's 8 steps against staging before this goes to production traffic,
same as flagged for the record-kind routes work earlier this week.

---

## Related

Supersedes the flat-role model noted as "explicitly descoped" in
`CAREGIVER-CONNECTED-SYSTEM-backend-requirements.md` §1, per that document's
own §10 reference. The reminder/push filtering in §7 above also affects
`NOTIFICATION-ACTIONS-backend-requirements.md`'s Snooze/Done buttons —
already covered in this build (see §7 above), not a separate follow-up.
