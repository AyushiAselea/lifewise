# Subscription Payment History — Backend Done

**Audience:** Frontend team
**Status:** ✅ Both backend pieces from `Subscription Payment History — Backend Requirements` are implemented, typechecked, and verified live with synthetic webhook events against a local instance connected to the shared MongoDB. Pushed to `origin/main` at commit `bb9c202`.
**Files changed:** `server/routes.ts`
**Read §0 first** — the original doc's premise doesn't match what's actually in this repo, and that changes what "done" means here.

---

## 0. Important — read before wiring anything up

The original requirements doc described this as upgrading an **existing** Payment History screen from "latest term, approximate price" to "every payment, exact charge." That screen, and the RevenueCat client integration it depends on, **do not exist in this repo**:

- No `react-native-purchases` (or any RevenueCat package) in `package.json`
- No `app/subscription/payment-history.tsx`
- No `lib/revenuecat.ts`
- No `SUBSCRIPTION_BACKEND_TODO.md`

What *does* already exist server-side is a separate, working plan/subscription model — `user.plan` / `planSource` / `planInterval` / `planRenewsAt`, `POST /api/subscription/purchase`, `POST /api/subscription/test-grant`, all built against `constants/plans.ts` (`free` / `starter` / `family` / `pro`). None of that talks to RevenueCat.

**What this means:** the two endpoints below are built and tested against RevenueCat's documented webhook event shape, ready for the moment RevenueCat is actually integrated client-side — but there is currently no app screen anywhere that calls `GET /api/subscription/payments`, and no purchases will ever reach `POST /api/webhooks/revenuecat` until a RevenueCat project exists and the app is wired to it (SDK added, `Purchases.configure()`, `logIn(userId)`, real product ids matching `constants/plans.ts`'s `productIdMonthly`/`productIdYearly`, and the webhook URL configured in the RevenueCat dashboard). If your team is not currently planning a RevenueCat integration, treat this as backend groundwork laid ahead of that work, not a drop-in upgrade to something already shipped.

---

## 1. What's live now

| # | Requirement | Result |
|---|---|---|
| 1 | `POST /api/webhooks/revenuecat` — shared-secret auth (not the app JWT), returns 200 fast | ✅ Built and tested |
| 2 | Idempotent on RevenueCat's `event.id` | ✅ Verified: sending the identical event id twice produced exactly one row both times |
| 3 | `subscription_payments` collection, unique index on `eventId`, plus `{ userId, purchasedAt }` for the list query | ✅ Both indexes created in `initIndexes()` |
| 4 | Sandbox events filtered out of user-facing queries | ✅ Verified: a `SANDBOX`-environment event is accepted and stored (for audit), but does not appear in `GET /api/subscription/payments` |
| 5 | `GET /api/subscription/payments` — scoped to `req.userId`, newest first, paginated | ✅ Verified: two separate users each see only their own rows; `?limit=` + `?before=` cursor pagination both tested and advance correctly with no overlap |
| 6 | Empty state returns `200` with `{ payments: [], hasMore: false }`, not `404` | ✅ Verified on a user with zero purchases |
| 7 | Full renewal history, not just latest term per product | ✅ Verified: three separate `RENEWAL` events for the same product produced three distinct rows — this is the exact case the client SDK alone cannot do |
| 8 | Refunds recorded | ✅ Verified: a `REFUND` event lands with `isRefunded: true` |

All 9 numbered tests in the original doc's §6 passed, run with synthetic payloads shaped like RevenueCat's real webhook format (`{ event: { id, type, app_user_id, product_id, purchased_at_ms, price, currency, store, environment, ... } }`).

---

## 2. `POST /api/webhooks/revenuecat`

Not called by the app — this is RevenueCat's server calling ours. Configure in RevenueCat dashboard → Project Settings → Integrations → Webhooks:

- **URL:** `<your deployed backend>/api/webhooks/revenuecat`
- **Authorization header value:** must exactly match the `REVENUECAT_WEBHOOK_SECRET` environment variable set on the server. Pick any long random string and set it in both places — RevenueCat's dashboard config and the backend's env — before going live. **This is not set in production yet**; the endpoint returns `401` on every call until it is.

Handles `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `SUBSCRIPTION_PAUSED`, `TRANSFER`, `REFUND`, `REFUND_REVERSED`. Events of any other type, or missing `event.id`/`app_user_id`, are acknowledged with `200` but not stored (so RevenueCat doesn't retry something we'll never be able to use).

`product_id` is mapped to our `plan`/`interval` via `constants/plans.ts`'s `productIdMonthly`/`productIdYearly` fields — **the real store product ids configured in RevenueCat must exactly match those strings** (`lifewise_starter_monthly`, `lifewise_family_yearly`, etc.) for a payment to resolve to a plan. If a webhook arrives for a product id that doesn't match any plan, the row is still stored (for audit via `rawEvent`) but `plan`/`interval` will be `null`.

---

## 3. `GET /api/subscription/payments`

```
Auth: required (standard Bearer JWT, same as every other authenticated route)
Query: ?limit=50&before=<ISO date>   (both optional; limit defaults to 50, capped at 200)

200:
{
  "payments": [
    {
      "id": "...", "type": "RENEWAL", "plan": "family", "productId": "lifewise_family_monthly",
      "interval": "month", "amount": 199, "currency": "INR", "store": "PLAY_STORE",
      "purchasedAt": "2026-07-15T10:22:31.000Z", "expiresAt": "2026-08-15T10:22:31.000Z",
      "isRefunded": false
    }
  ],
  "hasMore": false
}
```

For pagination: pass the `purchasedAt` of the last row you received as `before` to get the next page. `hasMore: true` means there are more rows older than what you got back.

This matches the response shape the original doc specified — if/when a payment-history screen is built, it can call this directly.

---

## 4. Backfill — still an open decision, unaffected by today's work

Per the original doc's §5: webhooks only fire from the moment they're configured, so anyone who subscribed before that moment has no history rows. Since there's no RevenueCat integration live yet at all, this is moot for now — **configuring the webhook before the first real RevenueCat-processed purchase means there is nothing to backfill, ever.** If RevenueCat integration and launch happen together, this concern disappears on its own.

---

## 5. What's needed before any of this does something useful

In rough order:
1. Add RevenueCat SDK, configure a RevenueCat project, wire `Purchases.configure()` + `logIn(userId)` client-side
2. Set matching product ids in the RevenueCat dashboard (must equal `constants/plans.ts`'s `productIdMonthly`/`productIdYearly` values)
3. Set `REVENUECAT_WEBHOOK_SECRET` on the deployed backend, and the identical value as the Authorization header in RevenueCat's webhook config
4. Build the actual Payment History screen and point it at `GET /api/subscription/payments`

None of these are backend work — flagging them so it's clear why "backend done" here doesn't yet mean "feature done."
