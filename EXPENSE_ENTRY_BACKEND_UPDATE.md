# Expense Entry Backend Update — Frontend Guide

**Audience:** Frontend team
**Status:** All six items below are committed and pushed to `main`. Render deploy is currently paused on the account side, so nothing is live yet — will go out automatically the next time the service is resumed. Each item was tested locally against the real production database and, for §6, the real S3 bucket (demo account, all test data cleaned up after) before pushing.
**Route base:** `/api/transactions`, `/api/recurring`, `/api/uploads`

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

## 4. Bulk transaction endpoint (for import)

```
POST /api/transactions/bulk
{ "transactions": [ { ...same shape as §1, plus optional dedupeKey }, ... ] }

→ 200 { "saved": 187, "skipped": 13, "failed": 0 }
```

Same field handling as the single-transaction route (`memberId` validated in one batched lookup, `paymentMode` whitelisted, invalid rows counted in `failed` without aborting the rest). `skipped` counts rows that matched an existing `dedupeKey`. `source` defaults to `"import"` here (vs `"manual"` on the single-row route) if you don't send one.

**Action for you:** `addTransactionsBulk()` in `lib/expense-context.tsx` currently posts one request per row in chunks of 5 — swap it to a single call to this endpoint. This is the ~10-line frontend change the product doc flagged as the one exception to "no frontend change needed."

---

## 5. CSV statement import — preview endpoint

```
POST /api/transactions/import/preview     multipart: file=<csv>

→ 200 {
    "rows": [ { "date", "description", "amount", "isDebit", "suggestedCategory", "dedupeKey" } ],
    "meta": { "format": "csv", "rowsFound": 42, "rowsSkipped": 0, "confidence": "high", "dateRange": { "from", "to" } }
  }
→ 422 { "message": "Could not read this statement. Try the CSV export instead." }
```

**CSV only in this pass** — PDF/XLS uploads currently get the same `422` fallback message. This matches the product doc's own assessment that CSV works reliably across every bank while PDF needs a separate per-bank effort (scoped to HDFC/ICICI later); shipping CSV first avoids a half-working PDF parser blocking the whole feature.

- Handles quoted fields (so `"UBER, INDIA"` with an embedded comma parses as one field, not two), common Indian date formats (`DD/MM/YYYY`), and both statement layouts: separate Debit/Withdrawal + Credit/Deposit columns, or a single Amount column with a Type/Dr-Cr column.
- `suggestedCategory` comes from the same AI categorizer used elsewhere in the backend (`categorizeTransactionsWithAI`) — if `OPENAI_API_KEY` isn't configured, every row falls back to `"others"` rather than erroring.
- **Read-only.** Nothing is written to the database by this call. Let the user review and uncheck rows, then commit the kept ones through §4's bulk endpoint (each row already carries its `dedupeKey`, computed the same way as the client-side formula in the original spec — `sha1(date|merchant|amount_paise)` — so you don't need to recompute it).
- The iOS Share Sheet integration to receive a PDF/CSV shared from a banking app (`CFBundleDocumentTypes` in `app.json`) is frontend/config work, not covered here.

---

## 6. Receipt image upload

```
POST /api/uploads/receipt     multipart: receipt=<image>

→ 201 { "url": "https://lifewise-storage.s3.us-east-1.amazonaws.com/receipts/<userId>/<timestamp>-<filename>" }
→ 400 { "message": "Only image files are allowed." }        (non-image MIME type)
→ 400 { "message": "Receipt image must be 5MB or smaller." } (oversized file)
```

Direct upload (not a presigned-URL flow) — same shape as the existing avatar upload route. Send the multipart image, get back a public URL, then send that URL as `receiptUrl` on `POST /api/transactions` (or in a bulk row).

**Action for you:** wire this into `QuickAddSheet.tsx` / `scan-bill.tsx` wherever "Receipt Photo — optional" is offered. No UI depended on this before, so nothing breaks by not doing it yet.

---

## Not done in this pass

- PDF statement parsing (HDFC/ICICI tabular formats) and password-protected SBI PDFs — deferred per the product doc's own sequencing; CSV path above covers the near-term need.
- iOS Share Sheet config for receiving shared PDFs/CSVs — frontend/`app.json` work, not backend.
