# Notification Title Format & Action Buttons — Backend Status

**Audience:** Frontend team
**Date:** 2026-08-20
**Source doc:** `Notification Title Format & Action Buttons — Backend Requirements` (2026-08-19)

| # | Ask | Status |
|---|---|---|
| §2 | Title format (`Reminder: …` / `Family Hub: … – …`) | ✅ Done |
| §3 | Action buttons (client-only) | N/A — no backend work |
| §4 | `data.categoryId` on every reminder push | ✅ Already done, earlier session |
| §5 | Server honours `minutes` on bill snooze | ✅ Already done, earlier session |
| §6 | Ship §2/§4 before/with server-side scheduling | ✅ Both already shipped |
| — | `sourceKind` list mismatch (see below) | ⚠️ Flagged, not silently changed |

---

## §2 — title format: done

New exported helpers in `server/family-reminders.ts`:

```ts
personalReminderNotificationTitle(recordTitle)
// -> "Reminder: <recordTitle>"

familyReminderNotificationTitle(memberName, recordTitle, familyName?)
// -> "Family Hub: <familyName ?? memberName> – <recordTitle>"
// en dash (–, U+2013), exactly as your doc specifies
```

`familyName` is accepted and used when present, per your §2 fallback note —
there is genuinely no household-name concept anywhere server-side today (no
`familyName`/`hubName`/`householdName` field on `family_members` or
`users`), matching what you found on the client. Wiring an owner-settable
household name is real, separate work; not built, not asked for here.

**One thing that needed care, not just a find-and-replace**: the family
scheduler's existing `reminder.name` field (`"<title> · <memberName>"`) is
also fed into `notificationBody()`/`notificationBodyMinutes()` to build the
notification *body* text, and is the exact contract
`FAMILY-REMINDERS-HOME-backend-requirements.md` documents for
`GET /api/reminders/family` rows. Reformatting `reminder.name` itself to
your new title format would have silently broken both of those. Instead,
`ProjectedFamilyReminder` gained a new `recordTitle` field (the bare title,
no member suffix) — the notification/push *title* is built from
`recordTitle` via the new helper; `reminder.name` and the body text are
completely unchanged.

Applied to all three reminder-type push sites:
- **Bill reminders** — push title is now `Reminder: <bill name>`. The
  in-app notifications-list title stays as the bare bill name (that list
  already sits under a "Reminders" heading, so re-prefixing there read as
  redundant — flag if you actually want it prefixed too).
- **Medicine dose reminders** — this was the exact line your doc quoted
  (`Time for ${member.name}'s medicine`). Now
  `familyReminderNotificationTitle(member.name, med.name)`, applied to
  both the push and the in-app notification (mixed-type list, so the
  "Family Hub:" framing is useful there too).
- **Family Hub projected reminders** (appointments, bills, tasks, routines,
  etc via the scheduler) — push title now uses
  `familyReminderNotificationTitle(reminder.memberName, reminder.recordTitle)`.

## §3 — action buttons: no backend work, confirmed correct already

Nothing to do here beyond §4 (the buttons are entirely client-registered
UI, gated only on `categoryId` being present). Confirmed §4 was already
correct before this doc arrived.

## §4 — `data.categoryId`: already done

This was built in an earlier session (`REMINDER_ACTIONS_CATEGORY =
'lifewise_reminder_actions'`, set on all three reminder push sites,
omitted on invite/sync/emergency pushes). Verified still present and
unchanged by today's title-format work.

## §5 — snooze `minutes` when `days: 0`: already correct

Re-confirmed by reading `POST /api/bills/:id/actions`:
`snoozeMinutes` is read first and takes priority over `days` whenever
it's a positive number — a `{days:0, minutes:10}` body produces a
10-minute snooze, not a no-op. This was flagged as unconfirmed in an
earlier doc and fixed/confirmed in an earlier session; still true today.

## §6 — sequencing: satisfied

Both §2 and §4 are live now, and server-side scheduling for Family Hub
reminders (the thing gated behind your `SERVER_PUSH_CONFIRMED` flag) was
already shipped in an earlier session too — so there's no risk of the
sequencing problem your doc warns about (server scheduling landing before
title/category support).

---

## ⚠️ One thing flagged, not silently changed: `sourceKind` values

Your §4 "valid `sourceKind` values" list is:

```
appointment · family-bill · subscription · task · routine · checkin
medicine-stock · travel · fitness · document · custom
```

The server's actual `FamilySourceKind` type is:

```
appointment · medicine-stock · family-bill · subscription · task · routine
checkin · travel · insurance · custom
```

Two differences: the server has `insurance` where your list has
`document`, and your list has `fitness`, which doesn't exist as a
projected reminder kind server-side at all (there's a `fitnessItems`
record kind stored per the PRD-compliance work, but no reminder
projection reads from it yet — `fitness` reminders aren't scheduled or
pushed today).

**I didn't rename or add anything for this**, because:
- Renaming `insurance` → `document` would be a breaking change to the
  `sourceKind` values `GET /api/reminders/family` has been returning —
  another doc (`FAMILY-REMINDERS-HOME-backend-requirements.md`) documents
  `insurance` as the contract value.
- Adding fitness-reminder projection/scheduling is real, separate work
  (a new loop in `family-reminders.ts`, a new push/scheduling path), not
  something to fold silently into a title-format pass.

If your Done-button dispatch logic is switching on `sourceKind ===
'document'` or `'fitness'` anywhere, that's currently a silent no-op per
your own doc's note ("an unrecognised `sourceKind` means Done silently
does nothing"). Let us know which of these you actually need —
`insurance`→`document` rename (with client update) or fitness reminders
built out — and we'll do it properly instead of guessing.

---

## Verified

Standalone check against `server/family-reminders.ts` directly (not a live
server this time — pure string formatting, nothing that needs a database):
`Reminder: Electricity Bill`, `Family Hub: Papa – Doctor Appointment`, the
`familyName` override producing `Family Hub: Smith Family – …`, and
confirmation that `reminder.name` (the `GET /api/reminders/family` /
body-text contract) is byte-for-byte unchanged. All passed. Full
typecheck clean, same pre-existing unrelated error count as before this
change.
