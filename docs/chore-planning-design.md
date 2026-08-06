# Chore planning rebuild contracts

Status: proposed implementation contract for review with the rebuild
guardrails. Changes to an accepted contract require a focused design review
before its dependent implementation PR changes.

## Release boundary and feature flag

`CHORE_PLANNING_ENABLED` is the backend-authoritative release control. It is
disabled unless its value is exactly `true`.

- Every chore-planning API router must be mounted behind the backend feature
  middleware. An authenticated request must receive `404` while the feature is
  disabled.
- The authenticated settings API publishes the effective flag to the frontend.
  The frontend must fail closed if that request fails.
- Every chore-planning route, navigation item, page, and mutation control must
  be rendered through the frontend feature gate. The backend remains
  authoritative even when the frontend displays a control.
- The production Terraform variable defaults to `false`. To change the flag,
  update the production GitHub environment variable
  `CHORE_PLANNING_ENABLED`, then manually dispatch the deploy workflow. An ECS
  task replacement is required because the backend reads configuration at
  startup.
- A slice that is not ready for use must not be mounted or linked merely
  because the broad feature flag is enabled. It remains unreachable until its
  implementation PR declares it complete.

## Plan ownership and lifecycle

A chore plan belongs to exactly one roster, and a roster may own at most one
plan. The database enforces that relationship with a foreign key and a unique
constraint on the roster identifier.

The lifecycle states are `draft`, `open`, and `closed`:

- A newly persisted plan is `draft`. Draft schedules and shifts are visible
  only to authorized administrators.
- `draft -> open` is allowed after backend validation succeeds. Opening records
  the actor and time in the same transaction.
- `open -> closed` is allowed. Closing records the actor and time in the same
  transaction and disables self-service mutations.
- `closed -> open` is the only reopening transition. It requires the dedicated
  reopen permission and a non-empty reason. The transition is audited in the
  same transaction.
- There is no transition from `open` or `closed` back to `draft`. Replacing a
  generated plan is allowed only while it is a draft.
- The plan row represents current state. Immutable audit entries preserve every
  lifecycle transition, actor, reason, and timestamp.

## Fixed catalog

PostgreSQL is the sole runtime source for the chore, event, and dinner
definition catalog. A forward migration installs the reviewed catalog; the
running application never reads a spreadsheet or external document.

Each definition has an immutable, human-readable stable key. The following
fields are fixed and may change only through reviewed code and a forward
migration:

- kind: `chore`, `event`, or `dinner`;
- shift label and position label;
- template day or explicit day metadata, including its display label;
- time-period label and period order;
- start and end local clock values;
- source order used for deterministic tie-breaking.

Definitions cannot be created, deleted, renamed, reordered, or otherwise
edited through an API. Stable keys are never reused for a different semantic
definition. A catalog migration must assert the exact key set and deterministic
order.

Catalog v1 contains 326 reviewed definitions: 32 chore template positions, 240
explicit event positions, and 54 explicit dinner positions. The snapshot was
verified on 2026-08-05 against workbook
`12QBFgX_jb9vdli-txNK4M2nkMt7TZ_FCHtX_gbEG9BM`, using `Chore template (One
day)`, `Event scores table (Week)`, and `Dinner scores table (Week)`. The
migration records each source tab's SHA-256 hash, and the PostgreSQL migration
test reconstructs the source CSVs from installed rows and requires exact hash
matches.

Stable keys are lowercase semantic identifiers. Chore keys identify the shift
and position, dinner keys identify the explicit day, shift, and position, and
event keys identify the period order, shift, and position. Period order is part
of event identity because the same shift and position recur throughout the
week. The migration pins the complete key set with a separate SHA-256 assertion.

Fixed definitions and editable scores use separate tables. Definition identity
and source order are unique at the database boundary. The score table accepts
only exact numeric values from `0` through `100` with no more than two
fractional digits. A singleton catalog-state row begins at revision 1 and is the
serialization point for future score updates.

The score is the only editable definition field. Scores are decimal values
from `0.00` through `100.00`, inclusive, with at most two fractional digits.
The database uses an exact numeric type plus a range constraint; the backend
applies the same validation before writing.

The catalog has one monotonically increasing revision. A score update accepts
only:

- the definition key;
- the replacement score;
- the caller's expected catalog revision.

The update locks the revision and definition rows. A mismatched revision
returns `409 Conflict`; it never silently overwrites a newer value. An unchanged
score is a successful no-op and does not increment the revision. A changed
score increments the revision once and writes an audit entry containing actor,
definition key, old score, new score, previous revision, new revision, and time
in the same transaction.

## Preview, apply, and reproducibility

Preview loads the catalog and its revision in one consistent database read.
After that boundary the planner is a pure function. For the same roster inputs,
catalog revision, and definition rows it must return byte-for-byte equivalent
ordered planning data.

The preview request accepts only a roster ID, a camper count from 1 through
200, and whole-number chore, event, and dinner requirements from 0 through 20.
The backend loads the roster and catalog in a read-only repeatable-read
transaction. It rejects missing rosters and fails closed if the catalog count,
keys, source order, event-period order, day metadata, timing, grouping, or score
values violate the reviewed catalog contract. Preview performs no writes and
has no network or document dependency.

Capacity targets are `camper count × per-camper requirement`. Chore templates
are instantiated across all seven planning days; explicit event and dinner
definitions occur once. Chore and dinner allocation first gives each ordered
shift group one position while capacity remains. All categories then choose
the highest-scored next position in a group. Ties resolve by current group
fill count, display day, source order, and stable key. Positions within a group
are prefixes of the reviewed source order, so a later position is never chosen
without the positions before it. Insufficient catalog capacity is represented
as an exact per-category shortage rather than a partial-write error.

Event period order defines the continuous event week. After-midnight periods
use their actual next-day timestamp while remaining grouped under the previous
display day; the final Sunday-after-midnight period is calendar day eight and
displays under Saturday. All local clock values are anchored to the roster
year in `America/Los_Angeles` and returned as UTC instants.

The preview response includes the catalog revision and stable definition keys
for every selected position, plus stable schedule/shift keys, ordered shifts,
exact selected/target/shortage summaries, position scores, and computed time
instants.

Apply does not trust client-supplied shift fields. Its request includes the plan
inputs, expected catalog revision, and the draft revision observed by the
caller (`null` when no draft was observed). The backend locks the catalog and
plan, rejects a stale catalog or mismatched draft revision with `409 Conflict`,
and recomputes the preview before writing. An identical retry is a successful
no-op even when it repeats the original `null` draft revision after the first
request committed. Replacing different draft contents requires the exact
current draft revision and increments it once. Schedule and shift stable keys
preserve matching rows across replacements. The whole apply operation,
including its audit entry, is transactional, so an error leaves no partial
plan.

Every persisted draft stores the catalog revision and a snapshot of each used
definition's stable key, fixed fields, and score. It also stores the planning
year, inputs, generated-shift display metadata, and a deterministic generation
hash. Later score edits affect only future previews and applies. They do not
mutate a persisted plan or its audit meaning. Generated draft schedules and
shifts are excluded from the ordinary schedule, shift, and signup APIs; a later
slice introduces their dedicated read contract.

## Requirements and overrides

Requirements are non-negative whole counts for the three categories: chore,
event, and dinner. Each value is between `0` and `20`, inclusive. The initial
plan defaults are three chores, three events, and one dinner per participant.

A participant without an override inherits all three plan values. An override
replaces the complete three-value vector; partial overrides are not stored.
Override values may not exceed their corresponding plan values. Creating,
changing, or clearing an override requires a reason and the appropriate admin
permission, and is audited in the same transaction. A zero value is an explicit
exemption for that category, not missing data.

One shared backend function computes effective requirements. Signup validation,
readiness, participant messaging, and final-assignment reporting must all use
that function.

## Signup and assignment integrity

Time intervals are half-open: `[startTime, endTime)`. Adjacent shifts do not
overlap. End times earlier than their local start clock are represented as the
following calendar day before conversion to an absolute timestamp.

Self-service chore signup requires all of the following at transaction time:

- the feature is enabled and the plan is `open`;
- the user is verified and belongs to the plan's roster;
- the full shift interval is inside the user's attendance interval;
- the shift does not overlap another assignment for the user;
- capacity remains; and
- the assignment does not violate duplicate or category rules.

Capacity-sensitive operations lock the shift row and count assignments inside
the transaction. The database unique constraint on `(shiftID, userID)` is the
last line of duplicate protection. Switching is one transaction that validates
the final state before removing the old assignment.

Ordinary shifts share the generic attendance, overlap, capacity, and duplicate
integrity rules. They do not inherit chore-plan lifecycle, category
requirements, catalog, or chore-specific authorization rules.

Administrative assign, unassign, move, and swap operations validate the final
assignment state in one transaction. A force operation requires a separate
permission, a reason, and an audit entry that records every bypassed rule. Force
never bypasses referential integrity or the duplicate-assignment constraint.

## Authorization

Authentication, roster membership, verification, permissions, and feature
state are checked by the backend. Frontend checks are presentation only.

The permission groups are deliberately separate:

- catalog read and score edit;
- plan preview and draft apply;
- lifecycle open/close and lifecycle reopen;
- requirement override management;
- ordinary self-service signup;
- administrative assignment;
- force assignment; and
- audit read.

Endpoints receive only the narrow permissions they need. Reading a preview does
not imply permission to apply it; ordinary assignment permission does not imply
force permission; and score editing does not imply definition editing.

## Audit and failure behavior

Score changes, draft applies/replacements, lifecycle transitions, requirement
overrides, administrative assignments, and force operations write immutable
audit records in the same transaction as their mutation. An audit failure
aborts the mutation.

Expected client conflicts use stable status classes: malformed input is `400`,
unauthenticated is `401`, unauthorized is `403`, disabled or absent feature
routes are `404`, stale revisions and lifecycle/capacity conflicts are `409`,
and valid but unsatisfiable planning inputs are `422`. Responses must not expose
database errors or stack traces.
