# Bug #10 — Money Leak Detection: Backend Fix Summary (for Frontend team)

**Status:** Both backend issues are now fixed, deployed to the shared dev DB, and verified live against `GET /api/leaks`.
**File changed:** `server/routes.ts` (route `GET /api/leaks`, ~line 2493)
**No API contract changes** — response shape is identical, only the values are now correct. No frontend code changes are required to pick this up.

---

## What changed

### Issue 1 — Essential payments no longer flagged as leaks

The category exclusion filter on the underlying transaction query was widened from:

```ts
category: { $nin: ['investment', 'tax', 'rent', 'savings'] }
```

to:

```ts
category: { $nin: ['investment', 'tax', 'rent', 'savings', 'bills', 'health', 'education', 'finance'] }
```

`bills`, `health`, `education`, and `finance` transactions are now excluded from leak detection entirely, in addition to the four categories that were already excluded. `subscriptions`, `entertainment`, `shopping`, `food`, and `travel` are unaffected — those are still detected as before (that's the intended behavior for this feature).

**Note:** there is currently no dedicated `insurance` or `loan`/`emi` category in `CategoryType` (`lib/data.ts`). If product wants those explicitly separated out from `finance`, that needs a shared schema change coordinated between backend and frontend — flagging it here, not done as part of this fix. No action needed unless you hear otherwise.

### Issue 2 — `monthlyEstimate` now reflects an actual monthly average

Previously the code had a dead/unfinished calculation (`data.total / (data.count > 30 ? 1 : 1)`) that always divided by `1`, so `monthlyEstimate` was really just the **lifetime total** spent at that merchant, not a per-month figure. This inflated both the per-card "per month" amount and the `yearlyPrediction` (which multiplies it by 12).

It's now computed from the actual observed date span per merchant:

```ts
spanMonths = max(1, (lastPaymentDate - firstPaymentDate in days) / 30)
monthlyEstimate = round(total / spanMonths)
```

So a merchant paid ₹5,000 total across ~2 months of observed activity now reports `monthlyEstimate ≈ 2,500`, not `5,000`. `yearlyPrediction` (`monthlyEstimate * 12`) is corrected automatically since it derives from this value.

The ghost-subscription leak (`frequency: "Inactive"`) and duplicate-charge leak (`frequency: "Critical"`) were already correct and are unchanged.

---

## Live verification performed

Ran the actual dev server against the shared MongoDB and hit `/api/leaks` directly as the demo account:

1. Seeded 3 `bills`-category transactions for the same merchant (would have triggered the old "3+ times = leak" rule) → **confirmed it no longer appears** in the response.
2. Seeded 5 `food`-category transactions for one merchant, ₹1,000 each, spread across ~2 months (₹5,000 total) → response returned `monthlyEstimate: 2542`, `yearlyPrediction: 30504` — consistent with a true monthly average, not the old `5000`/`60000`.
3. Test data was removed afterward; the demo account's `/api/leaks` response is back to its original `[]` (it doesn't have any naturally recurring transactions in its seed data — nothing else to see there).

No changes to request/response shape, so `useExpenses()` / `MoneyLeak` type consumption in [leaks.tsx](app/(tabs)/leaks.tsx) needs no updates.

---

## One thing worth a look on your side (not a backend blocker)

The "How it works?" card in [leaks.tsx](app/(tabs)/leaks.tsx#L134-L147) currently lists:

- High frequency of non-essential buys
- Unexpected bill price hikes
- Inactive legacy subscriptions

It doesn't yet mention that essential spending (bills, health, education, investments, etc.) is excluded from detection. Since the backend now actually guarantees that exclusion, you may want to add a line there so the copy matches the real behavior — purely a copy/UX call on your end, not required for correctness.
