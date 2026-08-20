# Bill Scanning — UPDATED Fix (v2) — Frontend Notice

**Created:** 2026-08-20  
**Updated:** 2026-08-20 — v2 fix deployed after real-world test failure  
**Status:** 🟢 Ready for testing  
**Audience:** Frontend team

---

## What Changed (v2)

The initial backend fix had a critical flaw: **when the LLM couldn't find the due date label, it silently returned `+7 days` at 95% confidence instead of being honest about the failure.**

This has been **fixed in v2**. Now:

✅ **If date is found:** returns correct date at 95% confidence  
✅ **If date is NOT found:** returns `null` at 70% confidence + user message  
❌ **Never again:** silently returns wrong fallback date

---

## New Response Format

### When date IS extracted successfully
```json
{
  "preview": {
    "name": "DGVCL Electricity",
    "amount": 1240,
    "dueDate": "2026-09-10T00:00:00.000Z",
    "category": "bills"
  },
  "metadata": {
    "confidence": 95,
    "method": "google-vision + puter-llm",
    "note": null
  }
}
```

**App displays:**
- Date: `10/9/2026` ✅
- Confidence banner: "AI extracted data with 95% confidence" (green) ✅

### When date is NOT found (new behavior)
```json
{
  "preview": {
    "name": "Electricity Bill",
    "amount": 1240,
    "dueDate": null,
    "category": "bills"
  },
  "metadata": {
    "confidence": 70,
    "method": "tesseract + puter-llm",
    "note": "Due date not detected. Please enter manually."
  }
}
```

**App displays:**
- Date field: "Not available" ✅
- Confidence banner: "AI could not fully read the bill — please verify & correct the fields below" (yellow) ⚠️
- User can tap to pick date manually ✅

---

## Frontend: Still ZERO Code Changes

The app **already handles `null` dueDate correctly:**

```tsx
// Line 716 in scan-bill.tsx
editingData?.dueDate
  ? new Date(editingData.dueDate).toLocaleDateString('en-IN')
  : t('scanBill.notAvailable')
```

When `dueDate` is `null`, it shows "Not available". No changes needed.

---

## What to Test

### Test Case 1: Date successfully extracted (happy path)
**Bill has:** Due date clearly printed (e.g., "Sep 10, 2026")

**Expected:**
- Review screen shows: `10/9/2026` ✅
- Confidence: 95% ✅
- Green banner: "AI extracted..." ✅

### Test Case 2: Date NOT extracted (new, honest behavior)
**Bill has:** Due date, but in a format OCR couldn't parse

**Expected:**
- Review screen shows: "Not available" ✅ (not a wrong date)
- Confidence: 70% ⚠️
- Yellow banner: "AI could not fully read..." ✅
- User taps date field → picks manually → saves ✅

### Test Case 3: The original failing bill
**Bill details:**
```
Invoice Date:  Aug 20, 2026
Due Date:      Sep 10, 2026
```

**Expected (v2 fix):**
- ✅ Shows `10/9/2026` (if LLM parsed "Sep 10, 2026"), OR
- ✅ Shows "Not available" (if OCR couldn't handle text format)
- ❌ NOT `27/8/2026` (the broken fallback from v1)

If "Not available" → user picks Sep 10, 2026 manually → all good ✅

### Test Case 4: No date on bill (edge case)
**Bill has:** No due date printed

**Expected:**
- "Not available" ✅
- User can pick manually ✅
- No false confidence ✅

### Test Case 5: Confidence levels in Network tab
Open DevTools → Network tab → scan a bill → check `POST /api/bills/scan/preview` response

**Expected:**
- `confidence: 95` when both amount AND date extracted ✅
- `confidence: 70` when only amount extracted (date missing) ✅
- `confidence: 40` when amount also missing ✅
- Never `confidence: 95` for a fallback date ✅

### Test Case 6: User manual correction persists
1. Scan bill that shows "Not available" for date
2. Tap date field → pick Sep 10, 2026
3. Tap Save
4. Navigate to Bill Details
5. Verify the date still shows Sep 10, 2026 ✅

---

## Changes in Backend (FYI)

**No need to code this yourself** — it's already in `server/routes.ts`. Just know:

1. **Removed silent fallback** — no more `+7 days` when date missing
2. **Better regex patterns** — catches more "Due Date" label variations
3. **Stricter LLM prompt** — explicitly tells LLM NOT to guess dates
4. **Confidence flag** — tracks whether date was actually extracted or just fallback
5. **Better error message** — app shows "Due date not detected" when missing

---

## No Frontend Code Changes

Do NOT modify:
- ❌ `app/scan-bill.tsx` (date display, date picker, etc.)
- ❌ Date parsing logic
- ❌ Confidence thresholds
- ❌ "Not available" text

Just test and confirm the behavior is better now.

---

## Rollout Plan

1. **Backend deploys v2 fix** (already done in this checkout)
2. **Frontend team runs Test Cases 1–6** (estimate: 15–20 min)
3. **Report findings:**
   - If all pass: mark fixed ✅
   - If any fail: escalate with test case + screenshot
4. **No frontend release needed**

---

## Success Criteria

| Test Case | Pass Condition |
|---|---|
| 1 | Date shows correctly, confidence 95 |
| 2 | Shows "Not available", confidence 70 (NOT 95) |
| 3 | Shows correct date OR "Not available" (NOT `27/8`) |
| 4 | Shows "Not available", user can pick manually |
| 5 | Confidence matches extraction result (not fake 95%) |
| 6 | Manually-set date persists after save |

**All 6 must pass.**

---

## If a Test Fails

### Test Case 1/3: Still showing wrong date (e.g., `27/8`)
**Action:** Backend fix may not be deployed. Check with backend team.

### Test Case 2/4: Still showing fallback date instead of "Not available"
**Action:** Backend deployed wrong version. Redeploy v2.

### Test Case 5: Confidence still 95 for missing date
**Action:** The `dateExtracted` flag may not be working. Check backend logs.

### Test Case 6: Manually-set date doesn't persist
**Action:** Not related to this fix. Check the `/api/bills/scan/commit` endpoint.

---

## Contact Points

- **Backend implementation:** `server/routes.ts` lines 3577–3727
- **Frontend code audit:** `app/scan-bill.tsx` lines 290, 671, 716, 799
- **Full technical details:** `BUG_REPORT_FOLLOW_UP.md`

---

## Quick Reference: What Changed

| Aspect | v1 (broken) | v2 (fixed) |
|---|---|---|
| No date found | Fallback to +7 days, report 95% | Return `null`, report 70% |
| User sees wrong date | Silently wrong ❌ | Honest "Not available" ✅ |
| User can correct | Has to edit detected date | Taps to pick date manually |
| User trust | Low (hidden failures) | High (transparent) |

---

## TL;DR for QA

✅ **No code changes to app**  
🧪 **Run 6 quick test cases**  
🎯 **Goal:** Verify the fix returns honest `null` instead of wrong dates  
📝 **Report:** Pass/fail for each test case  

**If all pass, bill scanning is fixed. 🚀**

