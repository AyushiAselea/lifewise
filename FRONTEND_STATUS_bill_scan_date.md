# Bill Scanning — Frontend Status
**Created:** 2026-08-20  
**Issue:** Wrong date extracted from scanned bills  
**Frontend Status:** ✅ **No changes needed**

---

## Summary

The frontend is a **pure pass-through** for bill scanning dates and requires **no changes**. The bug is entirely server-side; fixing it on the backend will fix the app with no client release.

---

## What the frontend does (code audit)

### Date flow in `app/scan-bill.tsx`

1. **Lines 205–228**: Send image to `/api/bills/scan/preview`
   ```js
   const res = await fetch(url, { method: 'POST', ... });
   const resJson = await res.json();
   setEditingData(resJson.preview);  // Line 228: store verbatim
   ```
   
2. **Lines 442–497**: Display the server's `dueDate` on the result screen
   ```js
   // Line 493: render the date as-is
   new Date(editingData.dueDate).toLocaleDateString('en-IN', { ... })
   ```

3. **Lines 515–524**: Manual date picker (user correction only)
   ```js
   if (date) setEditingData((p: any) => ({ ...p, dueDate: date.toISOString() }));
   ```
   This only runs when the **user taps to edit**; no auto-transformation.

4. **Lines 257–263**: Send the same `editingData` object back to `/api/bills/scan/commit`
   ```js
   body: JSON.stringify({ preview: editingData })
   ```

### Audit result

✅ There is **exactly one write** to `dueDate` in the scan flow — the manual date picker (line 521).  
✅ No parsing, format detection, or transformation happens client-side.  
✅ The server's response is displayed and re-sent **verbatim**.

**Conclusion:** Whatever the server sends as `dueDate`, the app displays and stores.

---

## What the backend must do

The server response format is already correct in the frontend's parser. For the fix to work end-to-end with **zero client changes**, ensure:

### 1. **Date format in response (required)**

Return `dueDate` as a full ISO 8601 UTC timestamp at **midnight**:

```json
{
  "preview": {
    "name": "Electricity Bill",
    "amount": 1240,
    "dueDate": "2026-08-15T00:00:00.000Z",
    "category": "bills"
  },
  "metadata": { "confidence": 0.92 }
}
```

**Why midnight UTC matters:**  
The app renders with `toLocaleDateString('en-IN')`, which converts to **IST (UTC+05:30)**. A late-day UTC time rolls the date forward:

| Server sends | App displays | Result |
|---|---|---|
| `2026-08-05T00:00:00Z` | `5/8/2026` | ✅ correct |
| `2026-08-05T19:00:00Z` | `6/8/2026` | ❌ **off by one day** |

### 2. **Return `null` for no date (required)**

When no date is found:
```json
{
  "preview": {
    "dueDate": null
  }
}
```

The app already handles this — it shows "Not available" and lets the user pick manually (line 493).

### 3. **Debug the two likely causes**

See the main bug report (§3):
- **Cause A (most likely):** DD/MM vs MM/DD misparsing — Indian bills are DD/MM/YYYY, but most date libraries default to US MM/DD/YYYY
- **Cause B:** Wrong date field picked — prefer labelled due date over invoice date

Test with:
- A bill dated **5/8/2026** (day ≤ 12) — must show 5/8, not 8/5
- A bill dated **25/8/2026** (day > 12) — should already work

---

## Testing on the app

Once the backend is fixed, test on the frontend like this:

1. **Navigate to Bills tab** → **Scan Bill** (or tap a bill to **Rescan**)
2. **Scan a bill** with a clear due date printed (e.g., `05/08/2026` or `25/08/2026`)
3. **On the review screen**, check that the date shown matches the bill
4. **Tap to edit** the date (optional) — the date picker should show the correct date
5. **Save the bill**
6. **Verify in bill details** that the due date matches what was printed

No special test case or configuration is needed — the app is ready to accept the fixed dates.

---

## Code references

- Date display: [scan-bill.tsx:493](app/scan-bill.tsx#L493)
- Date picker on user edit: [scan-bill.tsx:521](app/scan-bill.tsx#L521)
- Server response storage (no transformation): [scan-bill.tsx:228](app/scan-bill.tsx#L228)
- Date sent on save: [scan-bill.tsx:261](app/scan-bill.tsx#L261)

