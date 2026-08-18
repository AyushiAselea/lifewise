# Re: Caregiver Permissions — The Exact Missing Piece — Backend Response

**Audience:** Frontend team
**Date:** 2026-08-18
**Responding to:** `CAREGIVER-PERMISSIONS-EXACT-MISSING-PIECE.md` (2026-08-18)

Thank you for the apology and the much more specific report — this one was
genuinely useful and led to a real fix. Short version: **your diagnosis in
§2–§3 (the `GET` never returns `permissions`) doesn't match what's in the
code**, but testing it live surfaced a **different, real bug in the `PATCH`
route** that produces the exact symptom you described. Fixed. Also fixed
the `features: {}` vs `null` issue from your §8.

---

## What I actually found (tested against a running server, not just read)

I ran your own §6 test table end-to-end against a live instance: invite
with `permissions` in the body, accept, `GET` the caregiver list, `PATCH`
to change permissions, `GET` again, and a legacy (no-`permissions`)
caregiver. Every one of those round-tripped correctly — the `GET` **does**
return `permissions` on the caregiver row, omits it for the owner, and
`null`-permissions caregivers correctly keep full access. Your §2/§3
diagnosis isn't what's wrong.

**But then I tried something not in your test table: what happens if the
`PATCH .../permissions` body is wrapped as `{ "permissions": {...} }`
instead of the flat shape your docs specify.** That's the bug:

```
PATCH .../connected-caregivers/:id/permissions
Body: { "permissions": { "allowedModules": null, "accessLevel": "view" } }

→ 200 { "ok": true }
→ GET .../connected-caregivers afterward shows:
  "permissions": { "allowedModules": null, "accessLevel": "full" }
```

The owner set `view`. The caregiver got `full`. **That's your exact
symptom** — "View only" grants unrestricted access — and it reproduces
with a request shape one level off from what the endpoint expects. If the
app is sending the PATCH body wrapped (or if any of it — a stale build, a
different code path, a differently-shaped update call — sends it that
way), this is precisely what would happen, silently, with a `200` response
giving no indication anything went wrong.

## The fix

`parsePermissionsInput` (used by both the invite route and, until today,
the `PATCH` route) is deliberately lenient: on invite, omitting
`permissions` entirely is a valid, intentional "don't restrict yet" — so a
body with no recognisable `accessLevel` correctly falls back to `full`.
That same leniency was wrong for `PATCH`, where the entire point of the
call is the owner explicitly stating a caregiver's permissions — there,
falling back to `full` on a malformed body is exactly backwards.

New `parsePermissionsUpdate()`, now used only by the `PATCH` route:
- **Requires** `accessLevel` to be present and valid — no default, no
  silent fallback.
- **Rejects unrecognised top-level keys** with a specific error, so a body
  wrapped as `{ permissions: {...} }` now gets:
  `"Unrecognised field(s) on permissions update: permissions. Expected
  allowedModules and accessLevel at the top level, not wrapped in a
  \"permissions\" key."` — the message names the exact mistake instead of
  a generic 400.
- Still correctly accepts `allowedModules: null` (meaning "all modules")
  as valid, since `null` there is a real value, not an absence.

Re-tested against a live server after the fix:
- Wrapped body → `400` with the message above (was silently `200` before).
- Correctly-shaped flat body → `200`, and `GET` afterward shows the
  intended `accessLevel` (was previously also fine — this path was never
  broken).
- Missing `accessLevel` entirely → `400`.
- `PATCH` with `allowedModules: null` and a valid `accessLevel` → `200`,
  correctly stored as "all modules, level X."

The invite route (`parsePermissionsInput`) is unchanged — its leniency
there was correct and remains correct.

---

## §8 — `features: {}` vs `null`

Fixed on both counts you asked for:

1. **Read side** — all three response sites (`GET /api/family`,
   `GET /api/family/:id`, `GET /api/family/shared-with-me`) now send
   `features: m.features ?? null` instead of `m.features || {}`.
2. **Write side** — the actual root cause of why you'd never see `null` in
   practice: `POST /api/family` (creating a member) was unconditionally
   storing `features: features || {}`, so *every* new member got `{}`
   written to the database regardless of what the client sent. Now stores
   `features ?? null`, so a member created without an explicit `features`
   payload gets `null`, not `{}`.

**This only applies going forward.** Members created before this change
already have `{}` persisted in Mongo; there's no way to distinguish
"explicitly set to empty" from "never configured" for that existing data
without a migration, and you didn't ask for one. If you need existing
members backfilled to `null`, say so and we'll write one — it's a
one-line update filter (`{ features: {} }` → `$unset` or `$set: null`),
just didn't want to run a write migration without you asking for it
explicitly.

The `PUT /api/family/:id` edit route was already correct — it only writes
`features` when the client sends it, never coerces a shape.

`dateOfBirth`/`bloodGroup`: re-verified live, these are present and
correctly returned (`null` when unset, the actual value otherwise) on
every read route. If your app is still seeing them missing, that's not
reproducible from here — please send the exact response body you're
getting and we'll look at that specific case.

---

## What to do next

1. Re-run your §6 test table's step 4 (PATCH to `full` + `["health"]`,
   then GET) against a fresh deploy of this fix — should now behave
   correctly regardless of which body shape gets sent, since the wrong
   shape now errors instead of silently succeeding wrong.
2. If your app's actual PATCH call is sending the wrapped shape, that call
   site needs to change to the flat shape — otherwise every permission
   change from your `PATCH .../permissions` screen will now get a clear
   `400` instead of a silent wrong result, which is progress, but the
   screen will show an error until the call site is fixed.
3. Let us know if you want the `features: {}` → `null` migration run for
   existing members.
