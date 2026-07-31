# Currency Conversion — Backend Complete, Frontend Integration Guide

**Audience:** Frontend team
**Status:** Both backend items from the original spec (`Currency Conversion — Backend Note`, 2026-07-31) are implemented, committed, and pushed to `main` (`6009e07`).
**Verification:** Every endpoint below was exercised against the real MongoDB Atlas instance with a disposable test user (registered, tested, deleted). The 2-year backfill actually ran — 510 daily rows are live in the database today, not just code that could produce them.

---

## 0. TL;DR

| # | Item | Status |
|---|---|---|
| 1 | `preferredCurrency` on the user profile | **New** — `GET`/`PUT /api/auth/me` |
| 2 | `GET /api/exchange-rates/history` | **New** — 2 years backfilled, updates daily |
| 3 | Reminder emails use the right currency | **Fixed** — was hardcoded `₹` / `en-IN` |
| 4 | Historical rate lookup used by #3 | Backend-internal, no client action needed |

Nothing here requires you to change how amounts are stored or how conversion
happens on-device — the invariant from the original spec holds:
**amounts are stored in INR, currency is a display preference, conversion
happens at render time.** The backend does not convert stored amounts, ever.

---

## 1. Persist the currency preference

The backend previously had no idea what currency a user was viewing in — it
only lived in your `@lifewise_currency` AsyncStorage key. That's now
mirrored server-side.

```
GET /api/auth/me
Authorization: Bearer <token>
```

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "preferredCurrency": "INR",
    "...": "... (unchanged fields)"
  }
}
```

```
PUT /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json

{ "preferredCurrency": "USD" }
```

- Accepts any of the 7 codes in your `CURRENCIES` list: `INR`, `USD`, `EUR`,
  `GBP`, `JPY`, `AUD`, `CAD`. Case-insensitive (`"usd"` is normalized to
  `"USD"`) — verified live.
- Unsupported codes return `400` with a message listing the valid set —
  verified live (`"XYZ"` → 400).
- Defaults to `"INR"` for every existing user — verified live on an account
  that had never set it.
- Can be sent alongside `name`/`phone`/`avatarUrl`/etc. in the same `PUT`
  call, or on its own.

**Action for you:** call this `PUT` whenever the user changes currency in
Settings, in addition to (not instead of) writing `@lifewise_currency`
locally. This is what lets reminder emails (§3) and any future
server-rendered content pick the right currency — the in-app display still
uses your local `currency-context.tsx` as it does today.

---

## 2. `GET /api/exchange-rates/history`

This is what makes your historical-rate feature accurate for transactions
older than a device's install date — the thing the free `open.er-api.com`
endpoint structurally cannot do (no historical API, confirmed 404 on
date-specific queries).

```
GET /api/exchange-rates/history?from=2025-01-01&to=2026-07-31
Authorization: Bearer <token>
```

```json
{
  "base": "INR",
  "rates": {
    "2026-07-30": { "AUD": 0.01497, "CAD": 0.01468, "EUR": 0.00911, "GBP": 0.00781, "JPY": 1.7029, "USD": 0.01045 },
    "2026-07-29": { "AUD": 0.01506, "...": 0 }
  }
}
```

- **Base is always `INR`** — matches storage, matches your
  `convertForDisplayOn` math, no inversion needed on your end.
- Keys are `YYYY-MM-DD`. **Days with no published rate (weekends, ECB
  holidays) are omitted, not sent as `null`** — verified live (querying a
  Saturday/Sunday pair returns no entry for those two dates). Your existing
  "fall back to the most recent earlier day" logic is exactly the right way
  to consume this, no change needed there.
- `from`/`to` are required, must be `YYYY-MM-DD`, and `from` must not be
  after `to` — both violations verified to return `400`.
- Requires auth (`401` without a token) but is not user-scoped — every user
  sees the same global rate table.

**Backfill status (verified live, not a projection):** 730 days requested,
**510 rows actually stored** in the database today (the gap is weekends +
ECB holidays, exactly as expected — ECB publishes on business days only).
Oldest row is `2024-07-31`, newest is `2026-07-30`. A background job checks
hourly and stores each new day once ECB publishes it (there's a delay, so
"today" may briefly show no row — yesterday's remains the correct fallback
in the meantime, matching your existing behavior for missing days).

**Rate direction, sanity-checked:** `USD` sits around `0.0104–0.0119` across
the 2-year range, `JPY` around `1.7–1.8` — i.e. "1 INR = `rate` units of
`currency`," matching your on-device math exactly. Not inverted.

**Caching:** a past day's rate is immutable once stored — safe to cache this
response indefinitely on your end once you've fetched a given range. The
only day that can change on a re-fetch is "today," until ECB publishes it.

### Suggested integration

Per the original spec's intent, this doesn't replace `recordTodaysRates` —
it fills the gap that one can't: history from before install. A reasonable
approach:

1. On first load (or once, cached), fetch the full 2-year range and merge it
   into whatever AsyncStorage structure `formatAmountOn`/`convertForDisplayOn`
   already read from, so old transactions get real historical rates instead
   of falling back to today's rate.
2. Keep `recordTodaysRates` running as-is for ongoing days — the client-side
   daily snapshot and the server's daily row will very likely agree (both
   ultimately reflect the same day's market rate), but there's no need to
   change that mechanism.

---

## 3. Reminder emails now use your currency

**File:** `server/routes.ts` (reminder scheduler, email channel)

Previously the reminder email template always got `currency: '₹'` and
formatted amounts with `en-IN` grouping, regardless of what the user had
selected. Fixed:

- The scheduler now reads the recipient's `preferredCurrency` (defaulting to
  `INR` if unset) and converts the bill's stored INR amount using the latest
  known daily rate (§2's data) before rendering the email.
- Formatting now follows the currency: `en-US` for USD, `de-DE` for EUR
  (matches European grouping conventions), `ja-JP` for JPY with **zero**
  decimal places (JPY has no subunit — `¥12,345.6` would look wrong;
  it now renders `¥12,346`), etc.
- Verified live end-to-end: a ₹1,000 bill for a USD-preferring user
  converts to `$10.45` at the live cached rate (`0.01045` that day) — matches
  hand-computed expectations exactly.

**No action needed on your end** — this is purely a backend rendering fix.
Nothing about the API shape for bills/reminders changed.

---

## 4. What was explicitly NOT done (matches the spec's constraints)

- **No amounts are converted or rewritten in storage.** Every transaction,
  bill, and budget row is still an unlabeled INR number, same as before.
- **No currency column was added to any record.** If that ever happens, per
  the original spec it would represent *the currency the amount is stored
  in* (`INR` for all existing rows), never the currency the user was viewing
  in at creation time — flagging this again since it's an easy mistake to
  make later.
- **No per-row rate snapshots.** Rates live in one table keyed by date, not
  duplicated onto every transaction.
- **No interpolation for missing days.** Gaps are gaps; consumers carry the
  last known rate forward, same rule your client already follows.

---

## 5. Nothing blocking, no open questions

Unlike the Family Hub Reminders work, this one has no unresolved product
decisions — the original doc's scope was fully backend-shaped and is now
fully backend-complete. The only thing left is wiring your history fetch
into the existing on-device rate cache per §2's suggested integration,
whenever that's convenient.
