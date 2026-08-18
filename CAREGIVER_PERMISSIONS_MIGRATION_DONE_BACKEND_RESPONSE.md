# Re: Caregiver Permissions — Frontend Verification & Answers — Migration Done

**Audience:** Frontend team
**Date:** 2026-08-18
**Responding to:** `CAREGIVER-PERMISSIONS-FRONTEND-VERIFICATION-AND-ANSWERS.md` (2026-08-18)

Good news all around — thanks for confirming your PATCH body shape and for
tightening up error surfacing. One thing done on our side: the `features`
migration you requested has run.

---

## §4 — `features: {}` migration: done

Ran against the live database (not a dry read — verified before and after):

```
Before: 9 documents with features === {} (exactly empty object)
Ran:    $unset on features for those 9
After:  0 documents with features === {}
```

Spot-checked one migrated document directly — `features` is now fully
absent from the document (`hasOwnProperty('features') === false`), which
means the read-side fix (`m.features ?? null`) will correctly serialize it
as `"features": null` in every response, exactly what you asked for.

**Your safety filter held**: `{ features: {} }` matches only the exact
empty object, never a shape with keys — confirmed by also checking for any
document with `features.medicines` (the legacy boolean shape) before and
after; there were **none** in this database at all, so there was nothing
to accidentally touch either way. If your production data does have
legacy boolean-shaped members somewhere we don't have visibility into,
they'd have been safe regardless — the filter only ever matched the
literal `{}` case.

Script is committed at `scripts/migrate-empty-features-to-null.ts` if you
want to see exactly what ran, or need to point it at a different
environment later. It's idempotent — running it again is a no-op once the
count is 0, so no risk in re-running if you ever want to double check.

Total `family_members` count before and after: unchanged (31 → 31) — no
documents were created, deleted, or otherwise touched beyond the
`features` field on those 9.

---

## Everything else in your document — no backend action needed

- §1 (your PATCH body is flat, not wrapped) — good, confirms you're
  unaffected by the bug we fixed; nothing for us to change.
- §3 (error messages now surfaced to the user) — client-side change, no
  backend action, but appreciated: that's exactly the kind of thing that
  turns a `400` from useless-to-debug into actionable.
- §5 (re-running the enforcement table from `CAREGIVER-PERMISSIONS-backend-requirements.md`
  §9) — please do; that's the test that actually proves the original
  reported bug ("View only" caregiver can still write) is closed, more
  than the `PATCH`-shape table does now that we know you were never
  sending the wrong shape.
- §6 (dateOfBirth/bloodGroup, unconfirmed on your side) — left as you
  framed it: not a confirmed live defect yet. We'll wait for your
  re-test against the deployed API rather than re-assert from the repo
  again, per your own point in §2 about which side is authoritative.

Let us know what the §9 enforcement re-run turns up.
