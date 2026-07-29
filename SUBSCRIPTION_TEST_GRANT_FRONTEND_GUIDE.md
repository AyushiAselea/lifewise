# Test Payment Mode — Backend Endpoint Ready, Frontend Wiring Needed

**Date:** 2026-07-29
**For:** Frontend team
**Branch verified against:** `main` @ `c9a6d51` (this is the only branch confirmed
live on `origin` at the time of writing — see §0)
**Backend status:** ✅ `POST /api/subscription/test-grant` implemented and enforcing.
**Frontend status:** Wiring not present on this branch — see §0.

---

## 0. Branch note — read before assuming anything is already built

A prior handoff described a fully built frontend subscription layer
(`lib/entitlements.ts`, `lib/subscription-context.tsx`, `lib/revenuecat.ts`,
`lib/paywall-context.tsx`, a test-mode toggle in `app/subscription/index.tsx`) on
a branch `aselea-frontend-fixers` @ `420c7d4`.

That commit does not exist anywhere in this repository, and
`aselea-frontend-fixers` is not currently a live branch on `origin`
(`git ls-remote --heads origin` returns only `main`). If that work exists, it's
on a branch, fork, or machine not visible from here — **please push it and share
the branch name** so this doc can be reconciled against it instead of assumed.

**This doc is written against what actually exists on `main`:**
`constants/plans.ts` only. None of the four `lib/` modules above exist on this
branch. If your local checkout already has them, skip straight to §3 — you just
need the new endpoint wired into whatever `purchasePlan()` you already have.
Otherwise, §2 gives you a minimal path to the same goal.

---

## 1. What the backend now does

`POST /api/subscription/test-grant` — instantly grants a plan, no payment,
**non-production only**.

```
POST /api/subscription/test-grant
Authorization: Bearer <token>
Content-Type: application/json

{ "planId": "starter" | "family" | "pro", "interval": "month" | "year" }
```

**Success (200):**
```json
{ "ok": true, "plan": "family", "planInterval": "month", "planSource": "test" }
```

**Disabled in production (404):** the route returns 404, not 403, so its
existence isn't advertised to a production client. If you ever see a 404 here in
a real device build, that's expected — do not treat it as a bug.

**Validation errors (400):** unknown `planId`, or `interval` not `"month"`/`"year"`.

### Why this is enough to unlock real perks — not a fake tier

The backend does not have a separate "test" code path for limits or feature
flags. `getEffectivePlan()` and the enforcement check (`checkLimit()`) both read
`user.plan` directly, with no branch on `planSource`. So the instant this
endpoint sets `plan: "family"`, every one of the following reflects Family, with
zero special-casing:

- `GET /api/subscription/me` → `limits`, `flags`, `effectivePlan`
- `POST /api/family` (family member cap)
- `POST /api/bills` (reminder cap)
- `POST /api/bills/scan/commit` (bill scan cap)
- `POST /api/reminders/voice/parse` (voice cap)
- `POST /api/assistant/chat` (WiseAI cap)

`planSource: "test"` exists purely for bookkeeping — it is never read by any
enforcement logic. The only two things that differ from a real purchase:

| | `planSource: "store"` (real) | `planSource: "test"` |
|---|---|---|
| Limits / flags | Plan's limits | **Identical** |
| `planRenewsAt` | Set | **Never set** — doesn't expire on its own |

---

## 2. If `lib/subscription-context.tsx` etc. don't exist yet on your checkout

You need, at minimum, one function that calls this endpoint and refreshes
whatever state drives your gates. If you're building this fresh:

```ts
// lib/subscription-api.ts
import { getApiUrl } from '@/lib/query-client';

export type PlanId = 'free' | 'starter' | 'family' | 'pro';

export async function grantTestPlan(
  token: string,
  planId: Exclude<PlanId, 'free'>,
  interval: 'month' | 'year',
): Promise<{ ok: true; plan: PlanId; planSource: 'test' }> {
  const res = await fetch(new URL('/api/subscription/test-grant', getApiUrl()).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId, interval }),
  });

  if (res.status === 404) {
    throw new Error('Test grants are not available in this environment.');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Test grant failed: ${res.status} ${body}`);
  }
  return res.json();
}

export async function fetchSubscriptionMe(token: string) {
  const res = await fetch(new URL('/api/subscription/me', getApiUrl()).toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<{
    plan: PlanId;
    effectivePlan: PlanId;
    planSource: 'store' | 'test' | null;
    planStatus: 'active' | 'cancelled' | 'expired';
    planRenewsAt: string | null;
    trialStartedAt: string | null;
    trialUsed: boolean;
    trialDaysRemaining: number;
    usage: Record<string, number>;
    limits: Record<string, number | null>;
    flags: Record<string, boolean>;
  }>;
}
```

Wire the toggle to call `grantTestPlan`, then call `fetchSubscriptionMe` (or
whatever refresh function your subscription state exposes) so the UI picks up
the new plan immediately — see §4, this refetch is not optional.

---

## 3. If the subscription layer already exists on your checkout

Point whatever calls `/api/subscription/purchase` for the test path at
`/api/subscription/test-grant` instead. Same request shape
(`{ planId, interval }`), same auth header. Two behavioral differences to build
around:

1. **It 404s outside dev/staging.** Wrap the call so a 404 is treated as "test
   mode unavailable here," not a generic failure — don't let it fall through to
   a scary error toast.
2. **The response has no `planRenewsAt`.** If your purchase-success handler reads
   `planRenewsAt` off the response (e.g. to show "renews on..."), guard for
   `null`/absent and show something like "Test grant — active until you turn
   test mode off" instead.

Do **not** call `/api/subscription/purchase` for test grants going forward —
that endpoint sets `planSource: "store"` and a real `planRenewsAt`, making a free
test grant indistinguishable from a paying customer in the database. That's the
thing `test-grant` exists to avoid.

---

## 4. The one thing that will make this look broken if skipped

**A test grant only "works" once the client re-reads state from the server.**

The endpoint mutates the user record in the DB — it does not push anything to
the client. If your subscription state is cached (React Query, context state,
whatever) and you don't invalidate/refetch it after a successful grant, the UI
will keep showing the old plan and the old limits until the next natural
refresh, even though the server would already accept Family-tier requests.

After a successful `grantTestPlan()` call:
- Refetch `/api/subscription/me` (or invalidate the query key backing it)
- Make sure any local "remaining count" UI re-derives from the new `limits`/`usage`,
  not from a stale snapshot taken before the grant

Symmetrically: **enforcement is server-side now.** Don't rely on a locally
mocked/optimistic plan value to unlock UI that then calls a real endpoint — call
the five gated endpoints for real and let the actual response drive the UI. A
client that assumes success locally without confirming via `/api/subscription/me`
will drift from what the server will actually allow.

---

## 5. Suggested flow for the toggle

1. User enables test mode (dev-only UI, however you gate that client-side)
2. User picks a plan → confirm dialog ("test grant, no payment") → call
   `POST /api/subscription/test-grant`
3. On success, refetch `/api/subscription/me`
4. Update your subscription state from that response — `effectivePlan`,
   `limits`, `flags`, `usage`
5. Every gated action (add family member, scan bill, voice reminder, WiseAI
   chat, add reminder) now goes through the real endpoints and gets real
   Family/Pro/Starter behavior — nothing else to build for those five checks,
   they're already enforcing correctly for any `plan` value including a test one

To turn test mode off: nothing on the server needs to change automatically —
there's no auto-expiry. Options, depending on what you want the toggle-off
behavior to be:
- Call `test-grant` with `planId: "free"` to reset explicitly (works — `free` is
  a valid `planId`), or
- Leave it to whatever real purchase/restore flow you have to overwrite it later

If you want granted-but-then-abandoned test plans cleaned up in bulk before a
real launch, that's a server-side maintenance step
(`db.users.updateMany({ planSource: "test" }, ...)`) — flag it to the backend
team when you're getting close to shipping, it isn't something the client needs
to do.

---

## 6. Quick reference

| | |
|---|---|
| Endpoint | `POST /api/subscription/test-grant` |
| Auth | `Authorization: Bearer <token>` (same as everywhere else) |
| Body | `{ planId: "free"\|"starter"\|"family"\|"pro", interval: "month"\|"year" }` |
| Success | `200 { ok: true, plan, planInterval, planSource: "test" }` |
| Disabled | `404` (not 403) |
| Bad input | `400` |
| Refresh after | `GET /api/subscription/me` |
| Sets `planRenewsAt`? | No, ever |
| Distinguishable from real purchase? | Only via `planSource` field; entitlements identical |

---

## 7. Open question back to whoever has the other frontend branch

If the four `lib/` modules and the RevenueCat integration described in the
earlier handoff genuinely exist, please push that branch and share its name —
this doc's §2 (build-from-scratch) is only needed if they don't, and duplicating
that work would be wasted effort on both sides.
