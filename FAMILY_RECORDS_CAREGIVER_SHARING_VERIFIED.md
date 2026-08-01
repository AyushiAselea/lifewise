# Family Records — Server Persistence & Caregiver Sharing, Verified

**Audience:** Frontend team
**Status:** Everything requested in `Family Records — Server Persistence & Caregiver Sharing` (2026-08-01) already exists on the backend — built and pushed in earlier commits (`26c5a1d` onward). This document is the live re-verification against that doc's specific acceptance criteria, run fresh today with two real accounts on a clean server instance.
**If your app is still showing this bug:** see §0 — it's very likely not a backend gap.

---

## 0. Read this first if you're still seeing the bug

**The deployed backend at `https://lifewise-backend.onrender.com` is currently suspended** (`503`, `x-render-routing: suspend-by-user` — an explicit account-level pause, not a crash or cold start). Every check in this document was run against a local instance connected to the same production MongoDB Atlas database, and passed. If the app is pointed at the Render URL, none of this fixed behavior is reachable until that service is resumed from the Render dashboard. This isn't something fixable from code — it needs someone with Render account access to un-suspend it. Once resumed, it deploys from `main` automatically, so nothing else should be needed.

---

## 1. All 6 acceptance criteria verified live, today

Ran the exact reported scenario end-to-end with two fresh accounts (User A owns "Papa," invites User B, B accepts):

| # | Criterion | Result |
|---|---|---|
| 1-2 | A adds a doctor's appointment for Papa; it appears in A's own `GET /api/reminders/family` | ✅ Pass |
| 3 | **B, an accepted caregiver on a separate account, sees the same appointment via their own `GET /api/reminders/family`** | ✅ Pass — this is the exact bug reported ("it should appear... in the connected caregiver's [reminders]... currently it is not happening") |
| 4 | B marks it complete via `PATCH .../appointments/:id`; A sees `completed: true` after re-fetching | ✅ Pass — single record, both parties see the same state |
| 5 | Data survives a full server restart (equivalent to app reinstall — proves it's in MongoDB, not a cache) | ✅ Pass — created a record, killed the server process entirely, restarted, re-fetched, still there |
| 6 | No duplicate notifications; every connected party is notified once | ✅ Pass — created an imminent appointment, the scheduler produced exactly 2 notifications for 2 recipients (owner + caregiver), not 4, and repeated scheduler ticks didn't add more |

All test accounts, family members, and notifications created during this pass were deleted from the live database afterward.

---

## 2. What this confirms about the existing implementation

Everything in the original doc's §3 ("what the frontend already does — do not rebuild") and §4 ("required work") is already built:

- **§3.1 caregiver connection** — confirmed working exactly as described (invite → accept → `shared-with-me` → both parties resolve to the same member).
- **§4.1 persisted record types** — all 12 kinds from the table are registered server-side as array fields on the family member document (`appointments`, `medicationStock`, `familyBills`, `subscriptions`, `familyTasks`, `routines`, `checkins`, `travelItems`, `healthLogs`, `familyExpenses`, `documents`, `customItems`, plus `emergencySettings`/`emergencyLog`), with full CRUD.
- **§4.2 member-scoped authorization** — confirmed: access is granted if the requester is the member's owner *or* appears in `connectedCaregivers` with an accepted status. `createdByUserId`/similar attribution is not used for access control, matching the doc's explicit requirement.
- **§4.3 `GET /api/reminders/family`** — exists, returns the exact `id` format (`fam:{sourceKind}:{memberId}:{sourceId}`), the exact per-kind category/title/lead-time table from the doc, and scopes to owned + shared members in one call.
- **§4.4 push scheduler** — live and already gated correctly: it only fires for reminders the projection actually returns, fans out to owner + all accepted caregivers, and dedupes so nobody is notified twice.

**Write access:** caregivers have full read/write, not read-only — confirmed live in criterion #4 above (B's `PATCH` succeeded and was visible to A). This answers the original doc's §8.1 open question: write access, as the frontend already assumed.

**Caregiver removal:** confirmed by reading the code — removing a caregiver only removes them from the member's `connectedCaregivers` list. The family records themselves are untouched and stay with the member. This answers §8.2 exactly as the doc's own suggestion.

---

## 3. One real disagreement between specs — flagging, not resolving unilaterally

The original spec this backend was built against says completed/paid one-off
records (appointments, tasks, travel) produce **no** reminder at all once
completed — they're excluded from `GET /api/reminders/family` entirely, which
is what's live today (confirmed: the appointment vanished from the projection
the moment it was marked complete, in criterion tests above).

The newer doc's §4.3 says the opposite: *"Completed / paid records are still
returned with `isPaid: true` so the Completed section can render them."*

These are mutually exclusive for appointment/task/travel. **We kept the
existing, already-shipped behavior** (exclude on completion) rather than
silently flipping it, since this is a product decision about what the
Reminders tab should show, not a bug. If you want a "Completed" section in
the Reminders tab that needs completed items still present in this response,
say so explicitly and we'll change the projection — but confirm first,
since it's a behavior change from what's live and tested today, not a fix.

Note this doesn't affect `family-bill`/`subscription` — those already
correctly include an `isPaid`/paid-state flag either way; the disagreement
is specifically about whether the *item itself* disappears from the array
or stays with a flag.

---

## 4. Migration question from the original doc — still open

§8.4 asked whether the client should upload existing on-device records on
first launch. The backend side of this is already safe to build against:
`POST /api/family/:memberId/<kind>` is idempotent on a client-supplied `id`
(re-posting the same id merges instead of duplicating — this was verified
and documented separately in `FAMILY_RECORDS_SYNC_FRONTEND_GUIDE.md`). If
you want to implement the one-time upload, the endpoints are ready for it
today.
