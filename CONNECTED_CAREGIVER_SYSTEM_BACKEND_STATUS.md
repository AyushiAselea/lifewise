# Connected Caregiver System — Backend Status

**Audience:** Frontend team
**Status:** All 7 endpoints from `CONNECTED-CAREGIVER-SYSTEM-backend-requirements.md` (v2) are live on `server/routes.ts` at the `connected-caregivers` path (not the older, superseded `caregivers` path). Verified today end-to-end against a local instance connected to the same MongoDB used in production. If your app is still 404ing on these routes, see §0 first — it's very likely not a backend gap.

---

## 0. Read this first if you're still seeing 404s

Confirm which backend URL the app is pointed at. If it's the deployed Render URL and that service hasn't picked up this work yet, routes will 404 even though the code is correct and verified below. This doc reflects what's true of the code in this repo, run locally against the shared database — not necessarily what's live on the deployed URL at the moment you read this. Check with backend on deploy status if routes still 404 after confirming the URL is right.

---

## 1. All 7 endpoints, verified live today

Ran the full flow end-to-end with two fresh accounts (User A owns "Papa," invites User B by email, B accepts):

| # | Endpoint | Result |
|---|---|---|
| 1 | `GET /api/family/:memberId/connected-caregivers` | ✅ Returns owner + all accepted caregivers in one list, each tagged `role: 'owner'` or `'caregiver'`, with `name`/`email`/`avatarUrl` joined live from `users` (not cached) |
| 2 | `POST /api/family/:memberId/connected-caregivers/invite` | ✅ `201`, creates a pending `caregiver_invites` doc; `403` if a non-owner caregiver tries it |
| 3 | `DELETE /api/family/:memberId/connected-caregivers/:caregiverUserId` | ✅ Owner can remove anyone; a caregiver can only remove themself; confirmed B disappears from `shared-with-me` immediately after |
| 4 | `GET /api/caregiver-invites` | ✅ Returns B's pending invite by `req.userEmail`, matches the shape in the spec exactly |
| 5 | `POST /api/caregiver-invites/:inviteId/accept` | ✅ `200`, pushes B into the member's caregiver list, invite flips to `accepted` |
| 6 | `POST /api/caregiver-invites/:inviteId/decline` | ✅ Sets `declined`, no change to the member |
| 7 | `GET /api/family/shared-with-me` | ✅ Returns Papa for User B once accepted; same response shape as `GET /api/family`, including `features` |

Both `GET /api/family` and `GET /api/family/shared-with-me` include `features` in every item, so a caregiver's dashboard can tell which modules to render for a shared member.

All test accounts and family members created during this pass were deleted afterward.

---

## 2. Push notification payloads — confirmed shapes

| Type | When | Payload |
|---|---|---|
| `caregiver-invite` | Invite sent, invitee has an account + push token | `{ type: 'caregiver-invite', inviteId, route: '/caregiver-invites' }` |
| `caregiver-invite-accepted` | Invite accepted, notifies the owner | `{ type: 'caregiver-invite-accepted', memberId, route: '/caregiver-invites' }` — a superset of the spec's minimum (`route` present, plus an explicit `type` and `memberId`); should route correctly either way |
| `sync` (silent, data-only) | Any mark-done/status update on a shared member, from anyone connected | `{ type: 'sync', memberId, ... }` — no `title`/`body`/sound, confirmed data-only |

**Sync push coverage:** originally only the dedicated medicine mark-taken route sent the silent sync push. As of today it fires from **every** record-mutation route on a shared member, not just medicines:
- All 12 generic record types (`appointments`, `healthLogs`, `medicationStock`, `routines`, `familyBills`, `subscriptions`, `familyExpenses`, `familyTasks`, `documents`, `checkins`, `travelItems`, `customItems`) via their shared `PATCH /api/family/:memberId/<field>/:itemId` route
- `PATCH /api/family/:memberId/medicationStock/:itemId/adjust-stock`
- `PATCH /api/family/:memberId/emergency-log/:itemId`

Verified live: User B patched a `familyTasks` item, and the server attempted a push to User A's registered token in response (confirmed in server logs) — it excludes whoever made the change and sends to everyone else connected to that member.

---

## 3. One known status-code quirk — not part of this system, flagging only

`DELETE /api/family/:id` (deleting the member entirely, not removing a caregiver) returns `404` rather than `403` when a caregiver who isn't the owner attempts it. The action is still fully blocked either way — a caregiver cannot delete the member — but if your error handling branches specifically on `403` vs `404` for this call, it'll land in the `404` branch instead. This is a pre-existing route, unrelated to the caregiver-sharing work; flagging rather than changing its contract without being asked. Let us know if you need this changed to `403`.

---

## 4. Out of scope, unaffected by this work

- No new endpoints beyond the 7 above.
- Standalone bill reminders (`bills` collection — the personal, non-family-linked reminders) are not fanned out to caregivers; they have no `memberId` link to a family member in this data model. Family-linked bills (the `familyBills` record type on a shared member) already fan out correctly as part of §2 above.
- No frontend changes should be needed — every endpoint matches the shapes the app already expects to call.
