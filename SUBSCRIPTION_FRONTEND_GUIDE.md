# Subscription & Paywall — Frontend Integration Guide

**Date:** 2026-07-29
**For:** Frontend team
**Backend status:** ✅ Live and enforcing. Verified against `server/routes.ts` @ `c9a6d51`.
**Frontend status:** ❌ Not started. Everything below is to be built.

---

## 0. TL;DR

The backend already stores plans, meters usage, and **rejects over-limit requests
with HTTP 403 today**. The app does not handle those 403s, so users currently hit
a generic error instead of a paywall.

| # | Item | Priority |
|---|------|----------|
| 1 | Handle the `plan_limit` 403 on the 5 gated endpoints | **BLOCKER** |
| 2 | Add subscription fields to the `User` type + auth context | **BLOCKER** |
| 3 | Build `lib/subscription-context.tsx` (server-backed plan state) | **HIGH** |
| 4 | Build `lib/entitlements.ts` (limit/flag helpers) | **HIGH** |
| 5 | Build paywall UI + plan management screen | **HIGH** |
| 6 | Install & wire RevenueCat | **BLOCKED** — see §7 |
| 7 | Test payment mode toggle (`__DEV__` only) | MEDIUM |

**Read §1 before planning the work.** A previous handoff doc described this
feature as frontend-complete and backend-pending. That was inverted, and
estimates based on it will be wrong.

---

## 1. Correcting the earlier handoff

An earlier document ("Subscription — Test Payment Mode (frontend, done)")
described a set of frontend modules as complete. **They do not exist in this
repo.** Verified by direct inspection:

| Earlier doc claimed | Actual state |
|---|---|
| `lib/entitlements.ts` complete | **Does not exist** |
| `lib/subscription-context.tsx` complete | **Does not exist** |
| `lib/revenuecat.ts` complete | **Does not exist** |
| `lib/paywall-context.tsx` complete | **Does not exist** |
| `react-native-purchases` installed | **Not in `package.json`** |
| Test payment mode toggle shipped | **Does not exist** |
| `app/scan-bill.tsx` parses `plan_limit` | **No such handler** |
| Backend has no plan storage | **Backend has full plan storage** |
| `/api/bills/scan/commit` has no plan check | **It does — `routes.ts:2938`** |

`constants/plans.ts` is the one piece that does exist, and it is correct.

**Net effect:** this is a from-scratch frontend build against an API that is
already finished and already enforcing. Nothing in this guide asks the backend
for new work except §7.

---

## 2. What the backend already gives you

Base URL comes from `getApiUrl()` in [lib/query-client.ts](lib/query-client.ts).
All authed routes take the existing `Authorization: Bearer <token>`.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/plans` | The 4 plans (`PLANS` array, same shape as `constants/plans.ts`) |
| `GET` | `/api/subscription/me` | Plan, effective plan, trial info, usage, limits, flags |
| `POST` | `/api/subscription/trial` | Starts the one-time 7-day Family trial |
| `POST` | `/api/subscription/usage` | `{ key }` → increments a counter |
| `POST` | `/api/subscription/purchase` | `{ planId, interval }` → grants a plan |

### `GET /api/subscription/me` — the one call that matters

This is your single source of truth. It returns everything the UI needs:

```json
{
  "plan": "free",
  "planInterval": "month",
  "planStatus": "active",
  "planRenewsAt": null,
  "trialStartedAt": null,
  "trialUsed": false,
  "effectivePlan": "free",
  "trialDaysRemaining": 0,
  "usage": {
    "voiceReminderPerMonth": 0, "billScanPerMonth": 2, "wiseAiPerMonth": 4,
    "bankPdfImportPerMonth": 0, "noticeboardPostsPerMonth": 0
  },
  "limits": { "familyMembers": 1, "reminders": 5, "wiseAiPerMonth": 5, "...": "..." },
  "flags": { "pdfReports": false, "prioritySupport": false, "caregiverSharing": false }
}
```

**Use `effectivePlan`, never `plan`.** The server already folds the 7-day Family
trial into `effectivePlan` ([routes.ts:491](server/routes.ts#L491)). If you gate
on `plan`, trial users get locked out of everything they're paying attention to.

`limits` and `flags` are already resolved for `effectivePlan` — you do not need
to look them up in `constants/plans.ts` yourself. `null` in any limit means
unlimited.

---

## 3. BLOCKER: handle the `plan_limit` 403

The server returns this **right now** on five endpoints. Every one of them
currently surfaces to the user as a generic failure.

```json
{ "error": "plan_limit", "limitKey": "billScanPerMonth", "recommendedPlan": "starter" }
```

Returned with HTTP **403**. `recommendedPlan` is the next tier up that clears the
limit — show that plan in the paywall.

### The five gated endpoints

| Endpoint | `limitKey` | Source |
|---|---|---|
| `POST /api/family` | `familyMembers` | [routes.ts:654](server/routes.ts#L654) |
| `POST /api/bills` | `reminders` | [routes.ts:2716](server/routes.ts#L2716) |
| `POST /api/bills/scan/commit` | `billScanPerMonth` | [routes.ts:2938](server/routes.ts#L2938) |
| `POST /api/reminders/voice/parse` | `voiceReminderPerMonth` | [routes.ts:3221](server/routes.ts#L3221) |
| `POST /api/assistant/chat` | `wiseAiPerMonth` | [routes.ts:3782](server/routes.ts#L3782) |

### ⚠️ `apiRequest()` will destroy this response

[`apiRequest`](lib/query-client.ts#L48) calls `throwIfResNotOk`, which turns any
non-2xx into `new Error("403: {...json...}")` — the structured body becomes a
string inside an error message. **Do not use `apiRequest` for these five calls**
unless you first refactor it.

Use a helper that inspects the response before throwing:

```ts
// lib/plan-limit.ts
export type PlanLimitError = {
  error: 'plan_limit';
  limitKey: keyof PlanLimits;
  recommendedPlan: PlanId;
};

export function isPlanLimit(x: any): x is PlanLimitError {
  return x?.error === 'plan_limit';
}

/** Returns the parsed 403 body, or null if the response was not a plan limit. */
export async function readPlanLimit(res: Response): Promise<PlanLimitError | null> {
  if (res.status !== 403) return null;
  try {
    const body = await res.clone().json();
    return isPlanLimit(body) ? body : null;
  } catch {
    return null;
  }
}
```

Call site pattern:

```ts
const res = await fetch(url, { method: 'POST', headers, body });

const limit = await readPlanLimit(res);
if (limit) {
  showPaywall({ limitKey: limit.limitKey, recommendedPlan: limit.recommendedPlan });
  return;
}
if (!res.ok) throw new Error(await res.text());
```

> Not every 403 is a plan limit — auth failures use 403 too. Always check
> `error === 'plan_limit'` rather than treating bare status 403 as a paywall.

---

## 4. BLOCKER: subscription fields on the user object

The server already returns subscription fields on **all 8** auth responses
(`/login`, `/register`, `/oauth/google`, `/verify-otp`, `GET/PUT /api/auth/me`, …)
via `withSubscriptionFields` ([routes.ts:478](server/routes.ts#L478)).

**The app throws them away.** The `User` interface at
[lib/auth-context.tsx:9-17](lib/auth-context.tsx#L9-L17) doesn't declare them, so
they're silently dropped. Extend it:

```ts
interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  // add:
  plan?: PlanId;
  planInterval?: PlanInterval;
  planStatus?: 'active' | 'cancelled' | 'expired';
  planRenewsAt?: string | null;
  trialStartedAt?: string | null;
  trialUsed?: boolean;
}
```

This gives you a plan on the very first render after login, with no extra
round-trip — useful for avoiding a paywall flash before
`/api/subscription/me` resolves.

Note the auth payload has **no** `effectivePlan`. Treat it as a fast initial
hint; `/api/subscription/me` remains the authority.

---

## 5. Modules to build

### 5.1 `lib/entitlements.ts`

Pure helpers over the values from `/api/subscription/me`. No network, no state.

```ts
export function getLimit(limits: PlanLimits, key: keyof PlanLimits): number | null;
export function isUnlimited(limit: number | null): boolean;      // limit === null
export function hasRemaining(usage: number, limit: number | null): boolean;
export function isFeatureEnabled(flags: PlanFlags, key: keyof PlanFlags): boolean;
export function remainingCount(usage: number, limit: number | null): number | null;
```

`null` means unlimited throughout — mirror `constants/plans.ts`, and be careful
not to let `null` fall through a `>=` comparison as `0`.

### 5.2 `lib/subscription-context.tsx`

```ts
interface SubscriptionContextValue {
  plan: PlanId;               // = effectivePlan from the server
  planStatus: 'active' | 'cancelled' | 'expired';
  isTrialActive: boolean;     // trialDaysRemaining > 0
  trialDaysRemaining: number;
  trialUsed: boolean;
  usage: Record<keyof PlanLimits, number>;
  limits: PlanLimits;
  flags: PlanFlags;
  isLoading: boolean;
  refresh: () => Promise<void>;
  startTrial: () => Promise<{ success: boolean; error?: string }>;
}
```

- Fetch `/api/subscription/me` on mount and after login
- `refresh()` after any successful gated action, so counters stay accurate
- Server state wins. Do **not** persist plan to `AsyncStorage` as the source of
  truth — a device-local plan is spoofable and the server ignores it anyway.

Mount it inside `AuthProvider` in [app/_layout.tsx](app/_layout.tsx#L260) — it
needs the token.

### 5.3 Paywall

Trigger from two places:

1. **Reactive** — a `plan_limit` 403 came back (§3). Authoritative; always correct.
2. **Proactive** — local `usage`/`limits` show the user is at the cap, so you can
   disable a button or show "2 of 3 scans left" before they tap.

Proactive checks are **UX only**. Never let one substitute for handling the 403 —
counters go stale as soon as another device acts.

Paywall should show: which limit was hit (`limitKey`), the `recommendedPlan`, and
what that plan raises the limit to.

### 5.4 Trial

`POST /api/subscription/trial` starts a one-time 7-day Family trial.
Returns **409** if `trialUsed` is already true — handle that distinctly from a
generic failure. Hide or disable the trial CTA when `trialUsed` is true.

---

## 6. Plans catalogue

`constants/plans.ts` and the server are already in sync — the server imports the
same `LIMITS`/`FLAGS`/`PLANS`. Prefer `GET /api/plans` for display so pricing
changes don't need an app release, and keep the local file for types and for
rendering before the network resolves.

| id | name | ₹/month | ₹/year |
|----|------|---------|--------|
| free | Free | 0 | 0 |
| starter | Starter | 99 | 799 |
| family | Family | 199 | 1499 |
| pro | Pro | 499 | 3999 |

---

## 7. RevenueCat — blocked, do not start

`react-native-purchases` is not installed, and the **backend has no RevenueCat
integration at all**: no webhook consumer, no `/api/subscription/sync`, no
`rcAppUserId` field. Zero matches for `revenuecat` in `server/`.

Building the client SDK integration now would produce purchases the server never
learns about. **Wait for the backend webhook consumer** before wiring it up.

When it is ready you will need to: install the SDK, call `Purchases.logIn(user.id)`
after auth, present offerings, and call the sync endpoint after purchase. The
entitlement identifiers will be exactly `starter` / `family` / `pro`.

---

## 8. Test payment mode

Intent: a `__DEV__`-only toggle that grants a plan instantly so the app can be
exercised before Play Console is live. A test grant must unlock **identical**
perks to a real purchase — same limits, same flags, no reduced "test tier."

**How to build it so that actually works:** the entitlement that matters is the
one the *server* holds, because the server is what returns the 403s. A purely
device-local grant will not work — the app would show Pro while the server keeps
rejecting Pro-tier actions, which is the most confusing possible outcome.

So test mode must call a server endpoint. Today that is
`POST /api/subscription/purchase` (`{ planId, interval }`), which grants a plan
with no payment.

> ⚠️ **Flag this with the backend team before shipping.**
> `/api/subscription/purchase` ([routes.ts:2017](server/routes.ts#L2017)) has no
> payment verification, no `__DEV__` equivalent, and no env gate. Any
> authenticated user can grant themselves Pro with one request. It is also
> indistinguishable from a real purchase in the DB (no `planSource` field), so
> these grants can't be cleaned up before launch.
>
> Gating this endpoint is backend work and a **launch blocker**. Wrapping it in a
> `__DEV__` toggle on the client does not mitigate it — the endpoint is reachable
> from any HTTP client regardless of what the app does.

Keep the toggle behind `__DEV__` so it can't render in production, and expect the
endpoint's contract to change once it's gated.

---

## 9. Suggested order

1. `readPlanLimit` helper + wire the 5 endpoints (§3) — fixes a live bug
2. Extend `User` (§4)
3. `entitlements.ts` (§5.1)
4. `subscription-context.tsx` (§5.2)
5. Paywall UI + plan screen + trial (§5.3, §5.4)
6. Test mode (§8), once the backend has gated the endpoint
7. RevenueCat (§7), once the backend webhook exists

Steps 1–5 are unblocked and depend on nothing from the backend.

---

## 10. Open questions for the backend team

1. When will `/api/subscription/purchase` be gated? It's the §8 dependency and an
   open privilege-escalation path in production today.
2. Is a RevenueCat webhook consumer planned, and on what timeline? (§7)
3. `pdfReports`, `prioritySupport`, `caregiverSharing` are returned but never
   enforced server-side — is client-side gating the intended behaviour for now?
4. `bankPdfImportPerMonth` and `noticeboardPostsPerMonth` have counters but no
   enforcement site. Should the client increment them via
   `POST /api/subscription/usage`, or will those endpoints gate themselves?
