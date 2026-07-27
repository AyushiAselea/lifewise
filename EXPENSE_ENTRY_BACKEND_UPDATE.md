# Expense Entry Backend Update — Frontend Guide

**Audience:** Frontend team
**Status:** All three items below are committed and pushed to `main`. Render deploy is currently paused on the account side, so nothing is live yet — will go out automatically the next time the service is resumed. Each item was tested locally against the real production database (demo account, cleaned up after) before pushing.
**Route base:** `/api/transactions`, `/api/recurring`

Responds to the backend items requested in `LifeWise_Product_Logic_with_Timeline.pdf` §1–2 for iOS expense entry (Quick Add, receipt scan, voice input, recurring templates).

---

## 1. Transaction fields are no longer dropped

`POST /api/transactions` now accepts and persists the four fields the app already sends: `memberId`, `paymentMode`, `receiptUrl`, `source`. `GET /api/transactions` returns all four on every row, including legacy rows (`memberId: null`, `paymentMode: "upi"`, `receiptUrl: ""`, `source` preserved as originally stored — never `undefined`).

- `memberId` is validated against the user's `family_members`. A stale or unrecognized id does **not** 400 — it silently stores `null`, so a deleted family member never blocks saving an expense.
- `paymentMode` falls back to `"upi"` if missing or not one of `upi | cash | card | netbanking`.
- `source` and `receiptUrl` are stored as sent, defaulting to `"manual"` and `""`.

**Action for you:** `lib/expense-overlay.ts` (the local AsyncStorage cache that existed only because these fields used to vanish on refresh) can now be deleted — the server round-trips everything correctly.

---

## 2. Optional `dedupeKey` for safe re-imports

`POST /api/transactions` now accepts an optional `dedupeKey` string. When present, it upserts on `(userId, dedupeKey)` instead of always inserting — posting the same `dedupeKey` twice returns the original transaction unchanged rather than creating a duplicate. Omit it entirely and behavior is exactly as before (plain insert every time).

**Action for you:** nothing required yet for Quick Add / scan / voice. This exists as groundwork for the CSV/PDF import feature — generate `dedupeKey` client-side as `sha1(date_yyyy_mm_dd + "|" + normalized_merchant + "|" + amount_in_paise)` when that work starts, so re-importing an overlapping date range doesn't duplicate rows.

---

## 3. Recurring expense templates now sync server-side

New endpoints, all auth-scoped to the logged-in user:

```
GET    /api/recurring                → [ RecurringExpense ]
POST   /api/recurring                → RecurringExpense
PUT    /api/recurring/:id            → RecurringExpense
DELETE /api/recurring/:id            → 204
POST   /api/recurring/:id/handled    { period: "2026-07" } → 204
```

```
RecurringExpense {
  id, name, amount, category,
  dayOfMonth: 1-31,
  memberId: string | null,
  paymentMode?: "upi" | "cash" | "card" | "netbanking",
  lastHandledPeriod: "YYYY-MM" | null,
  createdAt
}
```

- `dayOfMonth` is clamped server-side to the month's last valid day (e.g. `31` stored against a template due in February is served back as `28`, never rolls into March) — same rule your client already applies, now enforced consistently if the two ever disagree.
- `memberId` validates the same way as transactions: invalid/stale id stores `null`, never a `400`.
- Calling `/handled` only sets `lastHandledPeriod` — it does **not** create a transaction. The confirmed expense still goes through `POST /api/transactions` as normal; this endpoint just tells the server "don't prompt for this month again."

**Action for you:** `lib/recurring-expenses.ts` (currently AsyncStorage-only) can be migrated to call these endpoints instead, which fixes the known cross-device sync and reinstall data-loss gaps.

---

## Next up (backend side)

§3 (bulk transaction endpoint), §4 (statement import parsing), and §6 (receipt image upload) are next in the backend queue — will follow up with a separate note once those land.
