# Chore planning production release runbook

This runbook releases the rebuilt chore planner through reviewed, auditable
changes. `CHORE_PLANNING_ENABLED` is the release switch. It is disabled unless
its value is exactly `true`, and changing it requires a focused PR whose merge
triggers a backend ECS deployment.

The release owner must keep a copy of
[`chore-planning-production-smoke-checklist.md`](./chore-planning-production-smoke-checklist.md)
with the reviewed commit, workflow runs, roster IDs, and results. Stop at any
failed gate. Do not repair production by editing an applied migration,
`knex_migrations`, or chore data by hand.

## Production controls

| Control                  | Production location                                                         | Expected value before release    |
| ------------------------ | --------------------------------------------------------------------------- | -------------------------------- |
| Feature flag             | `TF_VAR_chore_planning_enabled` in the `Deploy` workflow                    | `false`                          |
| Backend deploy           | `Deploy` workflow triggered by a push to `main`                             | Reviewed merge commit SHA        |
| Frontend deploy          | `Deploy Frontend to S3` workflow                                            | Same reviewed commit             |
| Database migration       | `Terraform Apply & Migrate` job or manual `Run ECS Migration Task` workflow | Exit code `0`                    |
| Read-only database audit | `Audit Chore Planning Release` workflow, dispatched from `main`             | `COMPLETE (READ ONLY)`           |
| Application logs         | CloudWatch Logs group `people-manager` in `us-west-2`                       | Structured `chore_plan.*` events |

The manual audit workflow is deliberately restricted to `main`, uses the
current production migration image and database secret, starts its transaction
as `REPEATABLE READ READ ONLY`, and reports only migration, catalog, plan, and
audit aggregates. Its optional `roster_id` input scopes plan and audit counts;
it does not print participant identities or audit detail text.

The feature flag is global, not an audience allowlist. The administrator-only
rehearsal stage is achieved by using a non-active roster, controlled test
accounts, and no open plan for the active roster. When the flag is on, verified
members can see the feature entry points, but they cannot mutate a missing,
draft, or closed plan.

## Gate 1: Deploy the complete stack disabled

1. Confirm every rebuild PR, including release readiness, has merged in order
   and all four checks passed at each reviewed head.
2. Confirm `TF_VAR_chore_planning_enabled` in the `Deploy` workflow on `main`
   is exactly `'false'`.
3. Record the resulting 40-character `main` commit SHA. The push to `main`
   automatically runs the backend `Deploy` workflow using that SHA for every
   image build and Terraform operation. Enter the same SHA as `ref` for the
   frontend workflow; do not use a branch name or substitute a later SHA.
4. Wait for the ECS service to become healthy and for every required migration
   task to exit `0`. The final rebuilt migration is
   `20260809000000_chore_plan_disabled_assignments.ts`.
5. Dispatch `Audit Chore Planning Release` from `main` without a roster ID.
   Confirm all eight rebuild migrations, both assignment-toggle tables, the
   pinned stable-key hash, catalog revision, 302 score rows, and exact
   definition counts of 32 chore, 216 event, and 54 dinner rows.
6. In an authenticated production browser, inspect
   `GET /api/settings/features` and confirm `chorePlanning` is `false`.
7. Confirm a direct authenticated request to a chore route, such as
   `GET /api/chore-plans/catalog`, returns `404`. Confirm chore navigation and
   pages are absent and no chore requests appear in the browser network log.
8. Exercise ordinary roster, profile, dues, schedule, shift signup, and shift
   removal flows. The disabled deployment is not accepted if an ordinary flow
   regresses.

This gate is the required production exercise of the disabled flag. Record its
workflow run, time, and operator in the smoke checklist before proceeding.

## Gate 2: Controlled administrator rehearsal

1. Select a non-active roster and at least two controlled test users. Record
   their IDs, confirm both attendance windows cover the test shifts, and
   confirm the active roster has no open chore plan.
2. Review and merge the focused feature-enablement PR whose only production
   behavior change sets `TF_VAR_chore_planning_enabled` from `'false'` to
   `'true'`. Record its merge SHA and wait for the automatically triggered
   `Deploy` workflow and ECS service to stabilize.
3. Confirm `GET /api/settings/features` reports `chorePlanning: true`. Confirm a
   verified standard user receives `403` from the catalog and planner
   endpoints.
4. Open Chore Scores as an administrator. Verify the 32/216/54 tab counts.
   Change one score, record its definition key and new revision, reload it,
   then restore the original score using the new revision. Record both
   revisions; each changed write must have one score audit entry.
5. Preview a plan for the non-active roster. Verify headcount, requirements,
   catalog revision, category targets, shortages, dates, and after-midnight
   periods. Do not apply a preview with a shortage.
6. Apply the draft and reload it. Verify the catalog and draft revisions plus
   schedule, shift, and slot counts. Repeat the identical apply and confirm it
   is a no-op. Disable one empty slot, verify it remains visibly disabled and a
   replacement is added, then re-enable it and verify the newest replacement is
   removed. Do not replace a draft without the explicit replacement review.
7. Review readiness. Resolve or explicitly accept participant, profile,
   attendance, requirement, and capacity warnings before opening.
8. Set and then clear one controlled participant requirement override, using a
   distinct reason for each change. Confirm the effective requirements and
   readiness counts refresh after both operations.
9. Open the plan. With a controlled member, exercise signup, an idempotent
   retry, switch, and removal. Confirm an invalid request and a lifecycle or
   category conflict are presented safely.
10. Increase the open plan's camper count once. Confirm existing assigned slots
    remain unchanged, only newly added empty capacity can be disabled, and a
    re-enable removes only the newest empty capacity from that update.
11. Exercise ordinary administrative assign, move, swap, and unassign. Create
    one controlled capacity conflict, confirm the ordinary operation returns
    `409`, then use the separate force endpoint with an operational reason.
    Confirm the response names exactly the bypassed capacity rule.
12. Close the plan. Confirm member assignments remain read-only, all mutation
    controls disappear, and Final Assignments renders stable chore, event, and
    dinner sheets in browser, narrow-screen, and print views.
13. Dispatch `Audit Chore Planning Release` from `main` with the rehearsal
    roster ID. Confirm the plan summary matches the UI and the audit counts
    include draft apply, open, close, requirement set/clear, administrative
    assignment, and at least one forced administrative assignment. Confirm the
    catalog score audit count advanced for the edit and restoration.
14. Run the CloudWatch queries below over the rehearsal window. Reconcile the
    generation, lifecycle, rejected-signup, capacity-conflict, and forced-admin
    events with the operations performed. Investigate any `internal_error`
    rejection before continuing.
15. If the active-roster release will not follow immediately, review and merge
    a focused disablement PR that changes the flag back to `'false'`, then wait
    for its automatically triggered deployment to stabilize.

## Gate 3: Active roster rollout

1. Confirm the reviewed commit, production snapshot policy, support contact,
   release owner, observer, and kill-switch operator.
2. If the flag is currently disabled, review and merge a focused enablement PR
   that changes it to `'true'`, then wait for the deployment to stabilize.
3. Preview and apply the active roster draft. Have a second administrator
   compare the catalog revision, headcount, requirements, dates, shortages,
   generated counts, and readiness results with the release record.
4. Do not open the plan until the second administrator signs off. Opening is
   the action that enables member self-service for that roster.
5. Open the plan and immediately run the participant smoke checks: load shifts,
   signup, idempotent retry, switch, and removal with a controlled member.
6. Monitor the queries below during the first real signup cycle. Compare
   readiness and capacity counts before and after material administrative
   changes.
7. Close the plan at the approved time, verify final assignments and printing,
   and run the roster-scoped read-only audit again.
8. Keep the flag, this runbook, and the recorded disable procedure available
   through the first complete signup cycle.

## CloudWatch operational queries

Run these in CloudWatch Logs Insights against `people-manager` in `us-west-2`.
The application writes stable JSON fields and deliberately omits names, email
addresses, and free-text reasons.

All chore operations in order:

```text
fields @timestamp, event, rosterID, actorUserID, operation, action, status, reason
| filter event like /^chore_plan\./
| sort @timestamp asc
```

Generation and lifecycle:

```text
fields @timestamp, event, rosterID, planID, changed, replaced, draftRevision, catalogRevision, action, fromStatus, toStatus
| filter event in ["chore_plan.preview_generated", "chore_plan.draft_applied", "chore_plan.lifecycle_changed"]
| sort @timestamp asc
```

Rejected self-service operations:

```text
filter event = "chore_plan.signup_rejected"
| stats count() as rejected by rosterID, operation, status, reason
| sort rejected desc
```

Capacity conflicts and force operations:

```text
filter event in ["chore_plan.capacity_conflict", "chore_plan.admin_force_completed"]
| stats count() as operations by event, rosterID, source, operation, conflictRule
| sort operations desc
```

## Disable and incident response

1. Prepare the smallest possible disablement PR changing
   `TF_VAR_chore_planning_enabled` in the `Deploy` workflow from `'true'` to
   `'false'`. Do not combine the switch with application, schema, or migration
   changes.
2. Review and merge the disablement PR to `main`. Record its merge SHA and wait
   for the automatically triggered `Deploy` workflow to finish using that SHA
   for the application image and Terraform operation.
3. Wait for ECS stability, then confirm the authenticated feature response is
   false, chore routes return `404`, and navigation is absent.
4. Preserve the plan, assignments, score history, and audit rows. Disabling the
   feature does not require a migration, data deletion, or lifecycle change.
5. Record the incident window and export the relevant CloudWatch event results.
   Run the roster-scoped read-only audit.
6. Before re-enabling, review any plan that was open when disabled. Its stored
   lifecycle remains unchanged even though routes were unavailable.

If disabling does not stabilize ordinary application behavior, keep the flag
off and prepare a normal reviewed rollback PR. Never remove or edit an applied
migration; schema corrections must be new forward migrations.

## Audit contract inventory

Every mutation that the design requires to be auditable writes its audit row
inside the same PostgreSQL transaction. An identical no-op does not add a
misleading audit record.

| Mutation endpoint                                                           | Immutable audit action                                                 | No-op behavior                            | Automated evidence                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| `PUT /api/chore-plans/catalog/:definitionKey/score`                         | `chore_catalog_score_audit_entries` old/new score and revision         | Unchanged score is not audited            | `chore_catalog_management.test.ts` |
| `POST /api/chore-plans/apply`                                               | `draft_applied` or `draft_replaced`                                    | Identical generation is not audited       | `chore_plan_draft.test.ts`         |
| `POST /api/chore-plans/:rosterID/open`                                      | `plan_opened`                                                          | Invalid transition is rejected            | `chore_plan_lifecycle.test.ts`     |
| `POST /api/chore-plans/:rosterID/close`                                     | `plan_closed`                                                          | Invalid transition is rejected            | `chore_plan_lifecycle.test.ts`     |
| `POST /api/chore-plans/:rosterID/reopen`                                    | `plan_reopened` with reason                                            | Invalid transition is rejected            | `chore_plan_lifecycle.test.ts`     |
| `PUT /api/chore-plans/admin/:rosterID/participants/:userID/requirements`    | `participant_requirements_overridden`                                  | Exact repeat is not audited               | `chore_plan_requirements.test.ts`  |
| `DELETE /api/chore-plans/admin/:rosterID/participants/:userID/requirements` | `participant_requirements_cleared`                                     | Missing override is not audited           | `chore_plan_requirements.test.ts`  |
| `POST /api/chore-plans/admin/:rosterID/assignments`                         | `admin_assignment_mutated`                                             | Idempotent assign/unassign is not audited | `chore_plan_assignments.test.ts`   |
| `POST /api/chore-plans/admin/:rosterID/force-assignments`                   | `admin_assignment_mutated`, with force reason and exact bypassed rules | Idempotent request is not audited         | `chore_plan_assignments.test.ts`   |

Preview, readiness, member/final views, and catalog reads are read-only and do
not create audit rows. Self-service signup, removal, and switch mutate only the
caller's assignment and were explicitly excluded from the immutable business
audit contract; rejected attempts emit the operational
`chore_plan.signup_rejected` event, with capacity also emitting
`chore_plan.capacity_conflict`.
