# Family Reminders — Delivery, Timing & Cross-User Sync — Backend Status

**Audience:** Frontend team
**Date:** 2026-08-18
**Source doc:** `Family Reminders — Delivery, Timing & Cross-User Sync — Backend Requirements` (2026-08-18)

| # | Ask | Status |
|---|---|---|
| §5 | Persist family records server-side | ✅ **Already done** — see correction below |
| §4 | Server push for family reminders (scheduler, 09:00 rule, `leadMinutes`, recurring weekdays, caregiver fan-out) | ✅ Done |
| §7 | Cutover flag coordination | ⚠️ Waiting on you — see below |
| §9 | Per-user timezone | ❌ No — answered below |

---

## Correction: §5 is not a gap

§5 states records "live only in on-device `AsyncStorage`" and that there's
"no write-through to the server for most kinds." That was true of whatever
snapshot this doc was written against, but **it isn't true of this repo
today**. All 8 kinds in §5's table — `appointments`, `medicationStock`,
`familyBills`, `subscriptions`, `familyTasks`, `routines`, `checkins`,
`travelItems` — have had full server-side `GET/POST/PATCH/DELETE`, scoped by
owner-or-accepted-caregiver, since earlier this week (see
`FAMILY_HUB_PRD_COMPLIANCE_BACKEND_STATUS.md` and the caregiver-permissions
work after it). `GET /api/reminders/family` projects directly from the
server-stored `family_members` document, not from anything on-device — a
record created by one account is visible to that same account's other
devices, and to any accepted caregiver, immediately.

Worth double-checking on your side: none of the files this doc cites
(`lib/family-records.ts`, `lib/family-reminders-api.ts`,
`lib/use-family-reminders.ts`, `lib/notification-actions.ts`) exist in this
repository. If your actual client codebase is separate from what's checked
in here, that's fine — just flagging so §5's premise doesn't get treated as
still-open when the server side of it isn't the blocker.

---

## §4: Server push for family reminders — done

Extended the existing family-reminder scheduler in `server/routes.ts`
(same `startReminderScheduler` that already handles bills and medicine
doses) plus `server/family-reminders.ts`'s projection.

### §4.1 — non-recurring kinds fire at every configured offset
Unchanged in spirit, but the offset source now branches three ways (see
§4.2–§4.4 below) instead of always being day-based.

### §4.2 — the 09:00 rule
`ProjectedFamilyReminder` gained `hasExplicitTime: boolean`. `true` for
appointments, travel, medicine-stock refills, routines, and check-ins (all
of which carry a real user-chosen clock time); `false` for family bills,
subscriptions, tasks, insurance/document reminders, and custom items (all
date-picker-only, midnight in storage). When applying a day-based offset to
a `hasExplicitTime: false` record, the scheduler moves the fire time to
09:00 — reusing the exact `REMINDER_SEND_HOUR` constant the bill scheduler
already uses, so behavior is consistent across both.

**Timezone caveat carries over unchanged from the pre-existing bill
scheduler**: this is 09:00 *server* local time, not per-user. See the §9
answer below — this was already true for bills before this change, not a
regression introduced here.

### §4.3 — `leadMinutes`
`ProjectedFamilyReminder.leadMinutes?: number[]` is now emitted exactly as
your spec's derivation table: appointment `reminderLead` →
`1_day`/`3_hours`/`1_hour`/`30_min` → `[1440]`/`[180]`/`[60]`/`[30]`,
defaulting to `[1440]` when unset; travel `reminderHoursBefore` → `[N*60]`,
defaulting to `[1440]` (24h) when unset. This field is on the row `GET
/api/reminders/family` already returns — no route change needed, it flows
through automatically now that the projection emits it. Family bills use
the day-based field instead, per your spec: `reminderDaysBefore =
[chosen] + (dayOfReminderEnabled ? [0] : [])`, deduped and sorted
descending, falling back to `[3, 1, 0]` when the record has no explicit
setting.

### §4.4 — recurring kinds (routine, checkin)
This was the actual "notifications not coming" bug for these two kinds:
the scheduler previously derived a fire time from the *projected* `dueDate`
(always "next occurrence," computed with no awareness of `weekdays`), so it
fired every day regardless of which weekdays were configured. Now: when a
reminder carries `recurrence`, the scheduler checks whether today is in
`recurrence.weekdays` (empty = every day) and, only if so, fires at
`recurrence.hour`:`recurrence.minute` — never off `dueDate` for these two
kinds.

### §4.5 — push payload
Matches your spec, plus one addition: `data.reminderId` (the same
`fam:<kind>:<memberId>:<sourceId>` string as `reminder.id`) is now sent
explicitly on both the push and the in-app `notifications` row, rather than
requiring the client to reconstruct it from `memberId`/`sourceKind`/
`sourceId`. Title/body format matches your spec: day-based bodies use the
existing `"is due today"` / `"in N days"` phrasing; a new
`notificationBodyMinutes()` helper produces `"in 30 minutes"` / `"in 3
hours"` / `"is tomorrow"` for `leadMinutes`-driven and recurring rows.

### §4.6 — caregiver fan-out
Already correct before this change (built during the caregiver-permissions
work) — `getRecipientUserIds` includes the owner and every connected
caregiver, filtered down to whoever has `allowedModules` access to that
reminder's module. No additional change needed here.

---

## ⚠️ §7 — the cutover flag: still your call, not shipped from our side

We haven't done anything that should make you flip `SERVER_PUSH_CONFIRMED`
yet, and we're not asking you to. Per your own doc's warning, that flag
should flip only after **your** device verification (§8, steps 1–6) passes
against a real build — not on our say-so that the code is written. We
haven't run those 8 steps end-to-end ourselves (no test infrastructure in
this repo, and there's a dev server we didn't want to disrupt — see the
note in the medicines-notifications status doc from earlier). Recommend
running §8 yourselves against staging before touching the flag.

---

## §9 — per-user timezone: no, we don't store one

Confirmed by reading the code: there's no timezone field anywhere on the
`users` collection, and the pre-existing bill scheduler already has a code
comment acknowledging this ("Server local time; if per-user timezones are
required this needs to move to a per-user check"). The family-reminder
09:00 rule added in §4.2 reuses that same server-local assumption for
consistency rather than introducing a second, different kind of wrong.

If you want this fixed properly (09:00 IST for an IST user, not 09:00
wherever the server happens to be), we'll need the device timezone sent on
login/refresh as you suggested — that's a real, separate piece of work
(store it, then thread it through both the bill and family-reminder
schedulers), not something folded into this pass. Let us know if you want
it prioritized.

---

## Related

`FAMILY-REMINDERS-HOME-backend-requirements.md` stays the authority on the
row shape, as your doc says — this work only adds `leadMinutes` and
`hasExplicitTime` to that shape, doesn't change anything else about it.
