# Chore planning production smoke checklist

Copy this checklist into the release record and link the completed record from
the release PR or issue. Detailed procedures and stop conditions are in
[`chore-planning-production-runbook.md`](./chore-planning-production-runbook.md).

## Release record

- Release owner:
- Observer:
- Kill-switch operator:
- Reviewed `main` commit:
- Backend deploy run:
- Frontend deploy run:
- Migration run:
- Disabled-state audit run:
- Rehearsal roster ID:
- Rehearsal audit run:
- Active roster ID:
- Active-roster audit run:
- Start/end time in UTC:

## Disabled deployment

- [ ] Production environment flag was recorded as exactly `false`.
- [ ] Backend `release_sha`, frontend `ref`, and deployed image tag match the
      recorded reviewed commit.
- [ ] ECS is healthy and required migration tasks exited `0`.
- [ ] Read-only audit reports all seven rebuild migrations, the pinned stable-key
      hash, and catalog counts 32 chore / 216 event / 54 dinner / 302 scores.
- [ ] Authenticated feature settings report chore planning disabled.
- [ ] Chore routes return `404`; navigation and network calls are absent.
- [ ] Ordinary roster, profile, dues, schedule, signup, and removal smoke tests
      pass.
- [ ] Disabled flag production exercise time and operator were recorded.

## Controlled rehearsal

- [ ] Non-active roster and controlled users were recorded.
- [ ] Flag enabled on the same reviewed commit; ECS is healthy.
- [ ] Standard user cannot access administrator catalog or planner APIs.
- [ ] Catalog counts match; one score edit and restoration advanced revisions.
- [ ] Preview has correct inputs, dates, targets, and zero shortages.
- [ ] Apply, reload, and identical no-op retry return expected revisions/counts.
- [ ] Readiness findings were resolved or explicitly accepted.
- [ ] Requirement override set and clear refresh all effective-requirement views.
- [ ] Open, signup, retry, switch, and removal behave as expected.
- [ ] Admin assign, move, swap, unassign, capacity conflict, and forced move
      behave as expected.
- [ ] Close and final assignments pass desktop, narrow-screen, and print checks.
- [ ] Roster-scoped read-only audit reconciles plan and required audit counts.
- [ ] CloudWatch events reconcile with the rehearsal; no unexplained internal
      error exists.
- [ ] Flag returned to `false` if active-roster rollout did not immediately
      follow.

## Active roster

- [ ] Current snapshot/backup policy and support contacts were confirmed.
- [ ] Two administrators approved active-roster preview and readiness results.
- [ ] Open transition was intentional and immediately followed by member smoke
      tests.
- [ ] Rejected signups, capacity conflicts, and forced operations are monitored.
- [ ] Close and final-assignment views were verified.
- [ ] Final roster-scoped read-only audit completed.
- [ ] Kill switch remains available through the first real signup cycle.

## Exceptions and sign-off

- Accepted warnings or exceptions:
- Follow-up issue links:
- Release owner sign-off and UTC time:
- Observer sign-off and UTC time:
