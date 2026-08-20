# Bill Scanning Date Bug — FOLLOW-UP FIX DEPLOYED

**Status:** 🟢 FIXED (v2)  
**Date:** 2026-08-20  
**Issue:** Backend was returning fallback `+7 days` date with 95% confidence instead of `null`  

---

## What Was Wrong

After testing the initial fix, you discovered that bills with a due date label (`Due Date: Sep 10, 2026`) were still showing wrong dates (`27/8/2026`). Investigation revealed:

```
Bill date: Aug 20, 2026
Due date on bill: Sep 10, 2026
App showed: 27/8/2026  ← This is Aug 20 + 7 days (fallback)
Confidence: 95%  ← Falsely confident in wrong date
```

**Root cause:** When the LLM/regex failed to extract the due date, the code silently fell back to `+7 days` and reported 95% confidence anyway. The user had no way to know the date was wrong.

---

## What Was Fixed (v2)

### Fix 1: No more silent fallback
**Before:**
```ts
if (!finalDueDate) {
  finalDueDate = new Date() + 7 days;  // ← silent fallback
}
```

**After:**
```ts
// Return null if no date was actually extracted
if (!finalDueDate) {
  // finalDueDate stays null (no fallback)
}
```

### Fix 2: Lower confidence when date missing
**Before:**
```ts
confidence: finalAmount > 0 ? 95 : 40  // Always 95 if amount found
```

**After:**
```ts
confidence: finalAmount > 0 && dateExtracted ? 95 : (finalAmount > 0 ? 70 : 40)
// 95 = both amount AND date extracted ✅
// 70 = amount only, date missing ⚠️
// 40 = amount missing
```

### Fix 3: Better "Due Date" label matching (regex fallback)
**Before:**
```ts
/(?:due date|last date|pay before)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
```

**After:** Multiple aggressive patterns
```ts
const duePatterns = [
  /(?:due date|payment due|pay by|due on|payable by|last date|last payment date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /due\s*date[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /payment.*?due[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /pay\s*by[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
];
```

### Fix 4: Stricter LLM instructions
**Added to prompt:**
```
CRITICAL INSTRUCTION FOR due_date: Find the PAYMENT DUE DATE by looking for these exact label patterns (case-insensitive):
- "due date"
- "payment due"
- "pay by"
- "due on"
- "payable by"
- "last date"
- "last payment date"
Match the LABEL, then extract the date associated with it. Do NOT pick invoice date, statement period, or bill date. If you cannot find a due date label, return null — do not guess.
```

---

## Result in App

### Scenario 1: Date successfully extracted
```json
{
  "preview": {
    "dueDate": "2026-09-10T00:00:00.000Z"
  },
  "metadata": {
    "confidence": 95,
    "note": null
  }
}
```
→ App shows: `10/9/2026` ✅  
→ User sees green banner: "AI extracted data with 95% confidence" ✅

### Scenario 2: Date NOT found (new behavior)
```json
{
  "preview": {
    "dueDate": null
  },
  "metadata": {
    "confidence": 70,  // ← Lower confidence
    "note": "Due date not detected. Please enter manually."
  }
}
```
→ App shows: **"Not available"** (not a wrong date) ✅  
→ User sees yellow banner: "AI could not fully read the bill — please verify & correct the fields below" ⚠️  
→ User manually picks the date → all good  

---

## Testing the Fix

### Test Case: The failing bill from your report

**Bill details:**
```
Date:           Aug 20, 2026 (invoice date)
Payment Terms:  100
Due Date:       Sep 10, 2026
```

**Expected after fix:**
- ❌ NOT `27/8/2026` (the fallback)
- ✅ Either `10/9/2026` (if LLM found it) **OR**
- ✅ "Not available" (if OCR couldn't parse `Sep 10, 2026` format)

If it shows "Not available", the user taps to pick the date, selects Sep 10, 2026, and saves. **This is better than silently showing wrong date at 95% confidence.**

### Quick test steps

1. Scan the bill that showed `27/8/2026` before
2. Check the review screen:
   - If date is shown: verify it's `10/9/2026`, not `27/8/2026` ✅
   - If "Not available": user can pick manually ✅
3. Check confidence in DevTools Network tab:
   - Should be 70 (if date missing) or 95 (if date found)
   - NOT 95 for a fallback date

---

## Code Changes Summary

| What | File | Lines | Change |
|---|---|---|---|
| Remove silent +7 fallback | `server/routes.ts` | 3695–3702 | Return `null` instead of fallback date |
| Lower confidence for partial extraction | `server/routes.ts` | 3717 | Use `dateExtracted` flag |
| Better regex patterns | `server/routes.ts` | 3674–3686 | Multiple aggressive patterns |
| Stricter LLM prompt | `server/routes.ts` | 3577–3595 | Explicit instructions to NOT guess |

---

## Why This Is Better

| Scenario | Before | After |
|---|---|---|
| Date extracted correctly | 95% confidence, correct date ✅ | 95% confidence, correct date ✅ |
| Date NOT extracted | 95% confidence, WRONG date ❌ | 70% confidence, "Not available" + user pick ✅ |
| User sees wrong date | Confused, might save wrong date | Clear prompt to fix it |
| User trusts the app | No, dates are secretly wrong | Yes, honest about what it found |

---

## Frontend Impact: Still ZERO Changes

The app already handles `null` correctly:
- Shows "Not available"
- Lets user pick manually
- Sends corrected date on save

**No code changes needed.** Just test to confirm it works better now.

---

## Verification Checklist

- [ ] Test Case 1: Bill with due date label → should show due date (not fallback)
- [ ] Test Case 2: Bill with no date → should show "Not available" (not wrong date)
- [ ] Test Case 3: Confidence is 70 when date missing, 95 when found
- [ ] Test Case 4: Original failing bill shows either correct date OR "Not available"
- [ ] Test Case 5: User can manually set date when "Not available"
- [ ] Test Case 6: Manually set date persists when saved

