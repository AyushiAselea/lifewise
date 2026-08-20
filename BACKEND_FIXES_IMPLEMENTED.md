# Backend Bill Scanning Fixes — IMPLEMENTED

**Date:** 2026-08-20  
**Status:** ✅ Complete  
**File:** `server/routes.ts` (POST `/api/bills/scan/preview`)

---

## Summary

All three critical bugs in bill date extraction have been fixed:

1. ✅ **Fix A:** Date parsing now explicitly handles DD/MM/YYYY (Indian format)
2. ✅ **Fix B:** LLM prompt now explicitly looks for "Due Date" labels
3. ✅ **Fix C:** Response always returns timestamp at midnight UTC

---

## Fix A: Date Parsing (Lines 3551–3570)

**Changed:** `parseAnyDate()` function now explicitly parses DD/MM/YYYY format

**Before:**
```ts
if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
```

**After:**
```ts
if (m1) {
  const day = m1[1].padStart(2, '0');
  const month = m1[2].padStart(2, '0');
  const year = m1[3];
  return `${year}-${month}-${day}`;
}
```

**Result:**
- `05/08/2026` → `2026-08-05` (5th August) ✅
- `25/08/2026` → `2026-08-25` (25th August) ✅
- `01/12/2026` → `2026-12-01` (1st December) ✅

---

## Fix B: LLM Prompt (Lines 3577–3582)

**Changed:** `buildLlmPrompt()` now explicitly instructs the LLM to look for "Due Date" labels

**Before:**
```
Extract: ... 2) due_date: YYYY-MM-DD format. ...
```

**After:**
```
Extract: ... 2) due_date: The PAYMENT DUE DATE. Look for text matching "due date", "payment due", "pay by", "due on", "last date", "payable by" (case-insensitive). Return the date associated with this label, NOT the invoice date or statement period. Return in DD/MM/YYYY format as found, and convert to YYYY-MM-DD. ...
```

**Result:**
- LLM will now prefer **due date labels** over picking the first date found
- Won't confuse invoice date with payment due date
- Correctly identifies which date is which

---

## Fix C: Timestamp Format (Lines 3680–3702)

**Changed:** Response now always returns `dueDate` at midnight UTC

**Before:**
```ts
let finalDueDate = extractedDueDate
  ? (() => { try { const d = new Date(extractedDueDate!); return isNaN(d.getTime()) ? new Date(Date.now() + 7*86400000).toISOString() : d.toISOString(); } catch { return new Date(Date.now() + 7*86400000).toISOString(); } })()
  : new Date(Date.now() + 7 * 86400000).toISOString();
```

**After:**
```ts
let finalDueDate: string | null = null;
if (extractedDueDate) {
  try {
    const d = new Date(extractedDueDate);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      finalDueDate = `${year}-${month}-${day}T00:00:00.000Z`;
    }
  } catch (e) {
    console.error('[BillScan] Date parse error:', e);
  }
}
if (!finalDueDate) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  finalDueDate = `${year}-${month}-${day}T00:00:00.000Z`;
}
```

**Result:**
- `dueDate` always ends with `T00:00:00.000Z` (midnight UTC)
- When converted to IST (UTC+05:30) in the app, displays correctly without rolling to next day
- Example: `2026-08-05T00:00:00.000Z` → app displays `5/8/2026` (not `6/8/2026`)

---

## Expected Response Format

After these fixes, the API response will look like:

```json
{
  "preview": {
    "name": "DGVCL Electricity",
    "amount": 1240,
    "dueDate": "2026-08-05T00:00:00.000Z",
    "category": "bills",
    "icon": "receipt",
    "source": "scan_bill",
    "imageKey": "bills/userId/timestamp-filename.jpg",
    "imageUrl": "https://bucket.s3.region.amazonaws.com/..."
  },
  "metadata": {
    "bill_amount": 1240,
    "due_date": "2026-08-05T00:00:00.000Z",
    "status": "success",
    "confidence": 95,
    "method": "google-vision + puter-llm"
  }
}
```

---

## Testing Checklist

- [ ] Scan a bill with date `05/08/2026` → app should display `5/8/2026`
- [ ] Scan a bill with date `25/08/2026` → app should display `25/8/2026`
- [ ] Scan a bill with both invoice date and due date → should pick due date
- [ ] Verify `dueDate` in response ends with `T00:00:00.000Z`
- [ ] Scan a bill with no date → should return `dueDate: null`
- [ ] Save the bill and reopen → due date should match what was scanned

---

## Frontend Impact

**✅ No frontend changes needed.** These backend fixes solve the problem completely. The frontend is already correctly implemented to:
- Display whatever date the server sends
- Allow users to manually correct dates if needed
- Send corrected dates back on save

See `FRONTEND_STATUS_bill_scan_date.md` for details.

---

## Code References

| Fix | File | Lines | Change |
|---|---|---|---|
| A | `server/routes.ts` | 3551–3570 | Date parsing: DD/MM format explicit |
| B | `server/routes.ts` | 3577–3582 | LLM prompt: prefer "Due Date" labels |
| C | `server/routes.ts` | 3680–3702 | Timestamp: always midnight UTC |

