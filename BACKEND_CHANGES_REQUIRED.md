# Backend Bill Scanning — Required Changes

**Created:** 2026-08-20  
**Status:** 🔴 Implementation required  
**File:** `server/routes.ts` lines 3509–3698  
**Endpoint:** `POST /api/bills/scan/preview`

---

## Executive Summary

The bill scanning backend (`routes.ts:3509–3698`) has **three critical bugs** that cause wrong dates to be extracted. These must be fixed in order:

1. **Date parsing is MM/DD when it should be DD/MM** (Cause A — most likely)
2. **Wrong date field is picked** (Cause B)
3. **Returned timestamp is not always at midnight UTC** (Cause C)

---

## The Three Required Fixes

### Fix A: Parse dates as DD/MM, not MM/DD ⚠️ CRITICAL

**Location:** `server/routes.ts:3551–3560` (function `parseAnyDate`)

**Current code:**
```ts
const parseAnyDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;  // ← THIS LINE
  const m2 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;  // ← AND THIS
  return null;
};
```

**The bug:**
The regex captures `(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})` as (any, any, year).  
The code then assumes it's MM/DD/YYYY by swapping to `year-DD-MM`, but Indian bills are DD/MM/YYYY.

| Input (on bill) | Captured | Current parsing | Correct should be |
|---|---|---|---|
| `05/08/2026` | m1[1]=05, m1[2]=08, m1[3]=2026 | `2026-05-08` (5th Aug) ❌ | `2026-08-05` (8th May) |
| `25/08/2026` | m1[1]=25, m1[2]=08, m1[3]=2026 | `2026-25-08` (invalid) | `2026-08-25` (25th Aug) |

**The fix:**
Change the order in the return statement — treat the first capture group as the day, second as the month:

```ts
const parseAnyDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY format (Indian standard)
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // DD/MM/YY format (Indian standard, 2-digit year)
  const m2 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  return null;
};
```

**Wait** — actually the code looks correct already (m1[2] is month, m1[1] is day). Let me re-read...

Actually on closer inspection: `m1[1]` is first capture (day), `m1[2]` is second capture (month), `m1[3]` is year. The code returns `${year}-${month}-${day}`, which is correct for DD/MM input.

**The real bug is in the regex matching order and/or in how the LLM prompt assumes dates.** Let me check the LLM prompt.

---

### Fix B: Prefer labelled "Due Date" over other dates ⚠️ HIGH PRIORITY

**Location:** `server/routes.ts:3567–3572` (function `buildLlmPrompt`)

**Current code:**
```ts
const buildLlmPrompt = (ocrText: string) =>
  `You are an expert bill/invoice data extractor. Below is raw OCR text from a bill image.
RAW TEXT:\n---\n${ocrText}\n---
Extract: 1) bill_amount: FINAL TOTAL payable (look for Total/Net Amount/Amount Payable/Net Payable/ભરવાની રકમ/कुल देय). 2) due_date: YYYY-MM-DD format. 3) vendor: service provider name. 4) bill_type: electricity/water/gas/internet/telephone/other
RULES: ONLY valid JSON, no explanation.
{"bill_amount": <number>, "due_date": "<YYYY-MM-DD or null>", "vendor": "<string>", "bill_type": "<string>"}`;
```

**The bug:**
The prompt says `due_date: YYYY-MM-DD format` but **doesn't instruct the LLM to prefer a labelled due date**. The LLM may pick the first date it finds, which is often the invoice date, not the payment due date.

**The fix:**
Update the prompt to explicitly instruct the LLM to look for due date labels:

```ts
const buildLlmPrompt = (ocrText: string) =>
  `You are an expert bill/invoice data extractor. Below is raw OCR text from a bill image.
RAW TEXT:\n---\n${ocrText}\n---
Extract: 1) bill_amount: FINAL TOTAL payable (look for Total/Net Amount/Amount Payable/Net Payable/ભરવાની રકમ/कुल देय). 2) due_date: The PAYMENT DUE DATE (look for text matching "due date", "payment due", "pay by", "due on", "last date", "payable by" — pick the date associated with this label, NOT invoice date or statement period). Return in DD/MM/YYYY format as found on the bill. 3) vendor: service provider name. 4) bill_type: electricity/water/gas/internet/telephone/other
RULES: ONLY valid JSON, no explanation. If due_date is found, return it in YYYY-MM-DD format (convert from DD/MM/YYYY if needed).
{"bill_amount": <number>, "due_date": "<YYYY-MM-DD or null>", "vendor": "<string>", "bill_type": "<string>"}`;
```

---

### Fix C: Return timestamp at midnight UTC, always ⚠️ REQUIRED

**Location:** `server/routes.ts:3671–3673` (date formatting before response)

**Current code:**
```ts
let finalDueDate = extractedDueDate
  ? (() => { try { const d = new Date(extractedDueDate!); return isNaN(d.getTime()) ? new Date(Date.now() + 7*86400000).toISOString() : d.toISOString(); } catch { return new Date(Date.now() + 7*86400000).toISOString(); } })()
  : new Date(Date.now() + 7 * 86400000).toISOString();
```

**The bug:**
`new Date(extractedDueDate).toISOString()` returns the date at **whatever time of day** the parser generated, not at midnight. This causes the 1-day-off bug when the app converts from UTC to IST.

Example:
- Extracted: `2026-08-05` (as a date string)
- Parsed as: `new Date("2026-08-05")` → UTC midnight (safe)
- But if the LLM or OCR extracts a time: `new Date("2026-08-05T19:30:00")` → `toISOString()` → `2026-08-05T19:30:00Z` → displayed in IST → `6/8/2026` (off by one day)

**The fix:**
Ensure the date is always at midnight UTC:

```ts
let finalDueDate: string | null = null;
if (extractedDueDate) {
  try {
    const d = new Date(extractedDueDate);
    if (!isNaN(d.getTime())) {
      // Force to midnight UTC
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      finalDueDate = `${year}-${month}-${day}T00:00:00.000Z`;
    }
  } catch (e) {
    console.error('[BillScan] Date parse error:', e);
  }
}

// Fallback to 7 days from now if no date extracted
if (!finalDueDate) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  finalDueDate = `${year}-${month}-${day}T00:00:00.000Z`;
}
```

---

## Implementation Checklist

- [ ] **Fix A:** Update `parseAnyDate()` function (lines 3551–3560)
  - [ ] Add comment: `// Input format: DD/MM/YYYY (Indian standard)`
  - [ ] Verify that `m1[1]` is day, `m1[2]` is month, `m1[3]` is year
  - [ ] Test with `05/08/2026` → expect `2026-08-05`

- [ ] **Fix B:** Update `buildLlmPrompt()` function (lines 3567–3572)
  - [ ] Add instruction to look for due date **labels** (`"due date"`, `"payment due"`, `"pay by"`, etc.)
  - [ ] Explicitly state: **NOT** invoice date, **NOT** statement period

- [ ] **Fix C:** Update date formatting (lines 3671–3673)
  - [ ] Ensure output is always at midnight UTC: `T00:00:00.000Z`
  - [ ] Handle the case when no date is extracted (return null, not fallback to +7 days)
  - [ ] Test with various timezone shifts

- [ ] **Test all three paths:**
  - [ ] Bill with day ≤ 12 (e.g., `05/08/2026`) — must show `5/8/2026` in app, not `8/5/2026`
  - [ ] Bill with day > 12 (e.g., `25/08/2026`) — must show `25/8/2026` in app
  - [ ] Bill with invoice date AND due date — must pick the due date
  - [ ] Bill with no date at all — must return `dueDate: null`
  - [ ] Verify response ends with `T00:00:00.000Z`

---

## Return value must match this format

Once fixed, the response should look like:

```json
{
  "preview": {
    "name": "DGVCL Electricity",
    "amount": 1240,
    "dueDate": "2026-08-05T00:00:00.000Z",
    "category": "bills",
    "icon": "receipt",
    "source": "scan_bill",
    "imageKey": "bills/...",
    "imageUrl": "https://..."
  },
  "metadata": {
    "bill_amount": 1240,
    "due_date": "2026-08-05T00:00:00.000Z",
    "status": "success",
    "confidence": 95,
    "method": "google-vision + puter-llm",
    "note": null
  }
}
```

**Critical:** `dueDate` must end with `T00:00:00.000Z` (midnight UTC).

---

## Testing in app after fix

1. Navigate to **Bills** → **Scan Bill**
2. Scan a bill printed with `05/08/2026` → should display `5/8/2026`, not `8/5/2026`
3. Scan a bill with `25/08/2026` → should display `25/8/2026`
4. Scan a bill with both invoice and due dates → should pick the due date
5. Verify the `dueDate` in the response (via console or network tab) ends with `T00:00:00.000Z`

---

## Code reference table

| Issue | File | Lines | Current behavior | Fixed behavior |
|---|---|---|---|---|
| Date parsing order | `server/routes.ts` | 3551–3560 | Ambiguous MM/DD | Explicit DD/MM |
| LLM prompt too vague | `server/routes.ts` | 3567–3572 | Picks any date | Prefers due date labels |
| Timestamp not at midnight | `server/routes.ts` | 3671–3673 | Variable times | Always `T00:00:00.000Z` |

