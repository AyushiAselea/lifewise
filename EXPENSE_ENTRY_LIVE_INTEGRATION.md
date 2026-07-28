# Expense Entry — Live Server Integration Guide

**Audience:** Frontend team
**Status:** Live and verified. All six endpoints below were checked against `https://lifewise-backend-5u6n.onrender.com` directly (real login, real writes, real S3 upload, cleaned up after) — not just tested locally.
**Base URL:** `https://lifewise-backend-5u6n.onrender.com`

This is the integration companion to `EXPENSE_ENTRY_BACKEND_UPDATE.md` (which explains *why* each change happened). This doc is just: point `EXPO_PUBLIC_DOMAIN` at the live server, here's exactly what to send and what comes back.

```env
EXPO_PUBLIC_DOMAIN=lifewise-backend-5u6n.onrender.com
```

Use the existing `apiRequest(method, route, body?, token?)` helper from `lib/query-client.ts` for all calls below — same as every other route in the app, nothing new to learn. `token` comes from `useAuth()`.

**Heads up:** `getApiUrl()` in `lib/query-client.ts` currently falls back to `api.lifewiseee.com` when `EXPO_PUBLIC_DOMAIN` is unset. That hostname doesn't appear anywhere else in the repo's docs and this Render URL is what `DEPLOYMENT_GUIDE.md` names as production — worth confirming with whoever owns DNS/domain setup whether `api.lifewiseee.com` is a real proxy in front of Render or a stale default that should be updated to point here directly.

**Note on Render free tier:** if the service has been idle, the first request after a while can take 30–60s (cold start) before it responds. Not an error — just don't set an aggressive client-side timeout on the first call of a session.

---

## 1. Transaction fields (`memberId`, `paymentMode`, `receiptUrl`, `source`)

```ts
await apiRequest('POST', '/api/transactions', {
  merchant: 'Dinner',
  amount: 1250,
  category: 'food',
  date: new Date().toISOString(),
  isDebit: true,
  description: 'Dinner',
  memberId: selectedMemberId ?? null,   // null for "me" — never omit if you have the field, just pass null
  paymentMode: 'upi',                    // 'upi' | 'cash' | 'card' | 'netbanking'
  receiptUrl: uploadedReceiptUrl ?? '',  // '' if none — see §6 for how to get this
  source: 'manual',                      // 'manual' | 'scan' | 'voice' | 'import' | 'recurring'
}, token);
```

`GET /api/transactions` now returns all four fields on every row (legacy rows included) — no more silent drops. You can delete the AsyncStorage overlay in `lib/expense-overlay.ts` now; the server round-trips everything.

A stale/deleted `memberId` never causes a `400` — it just comes back as `null`. You don't need defensive validation on your side before sending it.

---

## 2. `dedupeKey` (optional, for import work)

Add `dedupeKey: string` to the same POST body above and the server will upsert instead of insert — sending the same key twice returns the original transaction, no duplicate. Not needed for Quick Add / scan / voice (leave it out, behaves exactly as before). Relevant once you build the CSV import flow — see §5.

---

## 3. Bulk insert — `POST /api/transactions/bulk`

Replaces the current one-request-per-row loop in `addTransactionsBulk()` (`lib/expense-context.tsx`).

```ts
const res = await apiRequest('POST', '/api/transactions/bulk', {
  transactions: rows, // same shape as §1's body, array of them; dedupeKey optional per row
}, token);
const { saved, skipped, failed } = await res.json();
```

- `saved` — inserted or newly upserted.
- `skipped` — matched an existing `dedupeKey`, not duplicated.
- `failed` — row was missing `merchant`/`amount`; rest of the batch still committed.

One call instead of N — this is the ~10-line change to make in `addTransactionsBulk()`.

---

## 4. Receipt image upload — `POST /api/uploads/receipt`

```ts
const form = new FormData();
form.append('receipt', {
  uri: pickedImage.uri,
  name: pickedImage.fileName ?? 'receipt.jpg',
  type: pickedImage.mimeType ?? 'image/jpeg',
} as any);

const res = await fetch(`https://lifewise-backend-5u6n.onrender.com/api/uploads/receipt`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }, // do NOT set Content-Type manually — fetch sets the multipart boundary
  body: form,
});
const { url } = await res.json();
// pass `url` as receiptUrl in the §1 POST body
```

Use raw `fetch` here, not `apiRequest` — `apiRequest` JSON-encodes bodies, which breaks multipart uploads. This matches how avatar upload already works in the app if you want a reference implementation.

Limits: 5MB max, image MIME types only. Non-image → `400 "Only image files are allowed."`. Oversized → `400 "Receipt image must be 5MB or smaller."`.

---

## 5. CSV statement import — `POST /api/transactions/import/preview`

Same `fetch` + `FormData` pattern as §4, field name `file` instead of `receipt`:

```ts
const form = new FormData();
form.append('file', { uri: csvFileUri, name: 'statement.csv', type: 'text/csv' } as any);

const res = await fetch(`https://lifewise-backend-5u6n.onrender.com/api/transactions/import/preview`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});

if (res.status === 422) {
  // { message: "Could not read this statement. Try the CSV export instead." }
  // also what you'll get today for PDF/XLS uploads — CSV only for now
}

const { rows, meta } = await res.json();
// rows: [{ date, description, amount, isDebit, suggestedCategory, dedupeKey }, ...]
// meta: { format, rowsFound, rowsSkipped, confidence, dateRange }
```

This call **never writes to the database** — it's purely a preview. Show the user `rows` with checkboxes (per the product doc's review step), let them uncheck anything wrong, then POST the kept rows — each already carrying its `dedupeKey` — to §3's bulk endpoint to actually commit them.

---

## 6. Recurring expense templates — `/api/recurring`

Replaces the AsyncStorage-only `lib/recurring-expenses.ts`.

```ts
// List
const res = await apiRequest('GET', '/api/recurring', undefined, token);
const templates = await res.json();

// Create
await apiRequest('POST', '/api/recurring', {
  name: 'Rent', amount: 15000, category: 'bills', dayOfMonth: 1,
  memberId: null, paymentMode: 'upi',
}, token);

// Update (any subset of fields)
await apiRequest('PUT', `/api/recurring/${id}`, { amount: 16000 }, token);

// Delete
await apiRequest('DELETE', `/api/recurring/${id}`, undefined, token); // 204, no body

// Mark this month as asked (does NOT create a transaction — you still POST that separately via §1)
await apiRequest('POST', `/api/recurring/${id}/handled`, { period: '2026-07' }, token); // 204, no body
```

`dayOfMonth` is clamped server-side (`31` on a template due in February comes back as `28`) — matches your existing client-side clamp logic, now enforced consistently either way.

---

## Quick checklist

- [ ] Point `EXPO_PUBLIC_DOMAIN` at `lifewise-backend-5u6n.onrender.com` for testing against live
- [ ] Delete `lib/expense-overlay.ts`, confirm `memberId`/`paymentMode` survive a refresh (§1)
- [ ] Swap `addTransactionsBulk()` to call §3 instead of chunked single POSTs
- [ ] Wire "Receipt Photo" in Quick Add / scan-bill to §4, pass result as `receiptUrl`
- [ ] Migrate `lib/recurring-expenses.ts` to call §6 instead of AsyncStorage
- [ ] CSV import (Method 5) and Bank PDF import (Method 4) UI are still unbuilt on your side — §5 is ready whenever that work starts; PDF is intentionally not supported yet (server returns 422)
