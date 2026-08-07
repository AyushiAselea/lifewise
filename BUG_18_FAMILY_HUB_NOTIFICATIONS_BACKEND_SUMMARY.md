# Bug #18 — Family Hub: features with no reminder notifications

**Audience:** Backend + frontend leads (repo-boundary note below matters for both)
**Status:** Backend portion done for everything this repo can act on. See §0 — the source doc
describes a frontend file layout that does not exist in this repository.
**Depends on:** [BUG_17](./BUG_17_REMINDER_NOTIFICATIONS_FRONTEND_GUIDE.md) — fixed, see that doc.

---

## 0. Repo-boundary correction — read this first

The original report cites `lib/family-reminders.ts`, `lib/family-records.ts`,
`lib/family-features.ts`, and screens like `app/family-documents/add.tsx` and
`app/family-emergency/[memberId].tsx`. **None of these exist in this repository.** This repo
(`lifewise-backend`, deployed at `lifewise-backend-5u6n.onrender.com`) contains only:

```
server/family-reminders.ts   ← the server-side projection (real, exists, now extended)
app/family.tsx, app/add-family-member.tsx, app/edit-family-member.tsx  ← minimal, not the
   screen set the report describes
```

There is no `lib/` directory with a client-side reminder projector, no `family-records.ts`
defining `FamilyDocument`/`CustomTrackerItem`/`HealthLog`/`FamilyExpense`, and no
`family-documents` or `family-emergency` screens. The Expo/React Native frontend app lives in a
**separate repository** this session has no access to.

**What this means:**
- Everything in the original report scoped as frontend work (§2's frontend column, §6's copy
  suggestions for on-device text, the `isServerSchedulingActive` cutover flag in §7) **cannot be
  verified or actioned from here** — hand that half to whoever owns the Expo app repo.
- Everything scoped as backend work — the reminder projection and push/in-app fan-out — **does
  live here**, in `server/family-reminders.ts` and the scheduler in `server/routes.ts`. That part
  has been reviewed and extended; see §1-§3 below.

If the frontend file paths above do turn out to exist in another repo, this document's §1-§3
findings (what the server now emits) are what that repo's reminder consumer needs to match against.

---

## 1. What the server already had (verified before touching anything)

`server/family-reminders.ts` already projected **all 8** of the original `FamilySourceKind`
values into reminders — appointment, medicine-stock, family-bill, subscription, task, routine,
checkin, travel. This is wired into the scheduler at `server/routes.ts` (~4676, "Family Hub Phase
3"), which for every projected reminder:

- Inserts an in-app notification (`meta.type: 'family-reminder'`, with `sourceKind`, `sourceId`,
  `memberId` — matching field names, not the `kind` typo an earlier version had).
- Sends an FCM push via the shared `sendPushToTokenDocs` helper (`server/push.ts`) to the owner
  **and every connected caregiver** (`getRecipientUserIds`).
- Dedupes via `reminder_logs` on `(userId, billId=reminder.id, channel, dayOffset)`, so a
  restart or overlapping ticks cannot double-send.

So the report's claim that "only 2 of 15 features have push" was **already stale** by the time
this was investigated — 8 of the original set had push, not 2. It's possible the report was
written against the frontend's local-only view (`lib/family-reminders.ts`, which this repo can't
see) and didn't know the server-side fan-out already existed.

---

## 2. What was actually missing — insurance and custom trackers

Confirmed genuinely missing, matching §3 and §6 of the original report:

- **Insurance (`documents` array, `reminderDate` field):** the field is stored — the family
  member's `documents` array is a schema-less passthrough (`registerFamilyArrayFeature('documents')`
  in `routes.ts`) — but nothing ever read `reminderDate` to schedule anything.
- **Custom trackers (`customItems` array):** same situation — stored, never projected.

### Fix — `server/family-reminders.ts`

Added two new `FamilySourceKind` values, `'insurance'` and `'custom'`, with metadata and lead
times, and two new projection loops in `projectMemberReminders`:

```ts
// Insurance & Documents: reminderDate is optional per document (most documents,
// e.g. an ID scan, have none). Only documents that opted into a reminder project.
for (const doc of Array.isArray(member.documents) ? member.documents : []) {
  if (!doc.reminderDate) continue;
  const due = parseDate(doc.reminderDate);
  if (!due) continue;
  out.push(makeReminder('insurance', memberId, memberName, String(doc.id), doc.title || 'Renewal', due));
}

for (const item of Array.isArray(member.customItems) ? member.customItems : []) {
  if (item.completed) continue;
  if (!item.date) continue;
  const due = parseDate(item.date);
  if (!due) continue;
  out.push(makeReminder('custom', memberId, memberName, String(item.id), item.title || item.name || 'Reminder', due));
}
```

Lead times:

```ts
'insurance': [30, 7, 1],   // longer than bills — a renewal needs more notice than a due date
'custom': [1, 0],
```

**No changes needed anywhere else.** The scheduler loop in `routes.ts` that turns a
`ProjectedFamilyReminder` into an in-app notification + push is kind-agnostic — it iterates
`projectFamilyReminders(...)` and reads `reminder.sourceKind`/`reminder.name`/etc. generically,
never switching on the kind. Adding the two new kinds to the projector was sufficient to get them
push + in-app coverage, dedup, and (via the earlier BUG-17 fix in `push.ts`) the correct app icon
— all for free.

Verified with `tsc --noEmit` (clean on the touched files) and an `esbuild` production bundle
(succeeds).

**Open question carried over from the source report (§10):** is `[30, 7, 1]` the right lead
schedule for insurance renewals, or should it be configurable per-document? Went with a sensible
default; flag back if product wants something else.

---

## 3. What was intentionally *not* done, and why

- **Health / Expenses reminders.** Confirmed these are logs of past events
  (`healthLogs`, `familyExpenses` arrays), not schedulable due dates — building a due-date
  reminder against them would fire on records that already happened. The source report reaches
  the same conclusion (§4) and recommends deferring pending a product decision on what kind of
  nudge (absence-of-data alert, periodic digest) is actually wanted. Agreed — no server change
  made here.
- **Diet.** Not implemented anywhere in this repo (no `documents`-style array registered for it,
  no schema). Nothing to attach a reminder to; the feature itself would need to be built first,
  which is out of scope for a notifications bug fix.
- **The `isServerSchedulingActive` cutover flag** the source report warns about in §7 — this is
  an AsyncStorage flag read by the client's local scheduler, not something this backend repo
  defines or can flip. **Coordinate this explicitly with whoever owns the frontend repo before
  telling users insurance/custom reminders are live** — if their local scheduler is still active
  and unaware of these two new kinds, there's no double-send risk for insurance/custom
  specifically (the frontend never scheduled them locally to begin with, per the original
  report), but it's worth a sanity check on their side.

---

## 4. Checklist status

| Item from original report | Status |
|---|---|
| BUG-17 prerequisite | ✅ Fixed (see BUG_17 doc) |
| Push for 8 existing `FamilyReminderKind` values | ✅ Already existed, verified working |
| Push for `insurance` | ✅ Added this pass |
| Push for `custom` | ✅ Added this pass |
| Icon/color/channelId on new send sites | ✅ Free — routes through the shared `push.ts` helper fixed in BUG-17 |
| Dedup via `reminder_logs` | ✅ Free — generic loop, no new dedup logic needed |
| `isServerSchedulingActive` flag coordination | ⏸ Frontend-repo concern, flagged above |
| Health/Expenses reminders | ⏸ Deferred pending product decision, per report §4 |
| Diet | ⏸ Feature doesn't exist; out of scope |

---

## 5. Files changed

- `server/family-reminders.ts` — added `insurance` and `custom` to `FamilySourceKind`,
  `KIND_META`, `LEAD_TIMES`, and two new projection loops.

No other files required changes — the scheduler, push helper, and in-app notification path were
already generic enough to pick up the new kinds automatically.
