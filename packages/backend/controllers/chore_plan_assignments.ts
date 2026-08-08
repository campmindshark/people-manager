import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanAssignmentError from '../utils/chorePlanAssignmentError';
import { MAX_CHORE_PLAN_FORCE_REASON_LENGTH } from '../utils/chorePlanAssignmentInput';
import {
  effectiveRequirements,
  requirementForKind,
  ChorePlanRequirementColumns,
} from '../utils/chorePlanRequirements';
import { shiftTimeRangesOverlap } from '../utils/shiftTime';
import {
  ChorePlanAdminAssignmentMutation,
  ChorePlanAdminAssignmentMutationResponse,
  ChorePlanAdminAssignmentParticipant,
  ChorePlanAdminAssignmentShift,
  ChorePlanAdminAssignmentViewResponse,
} from '../view_models/chore_plan_assignments';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';

type ChorePlanKind = 'chore' | 'event' | 'dinner';

interface PlanRow extends ChorePlanRequirementColumns {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
}

interface ParticipantRow {
  id: number;
  rosterID: number;
  userID: number;
  firstName: string | null;
  lastName: string | null;
  playaName: string | null;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

interface GeneratedShiftRow {
  id: number;
  chorePlanID: number;
  stableKey: string;
  kind: ChorePlanKind;
  scheduleName: string;
  displayDayNumber: number;
  displayDayLabel: string;
  timePeriodLabel: string;
  periodOrder: number | null;
  startTime: Date | string;
  endTime: Date | string;
  requiredParticipants: number;
}

interface AssignmentRow {
  userID: number;
  shiftID: number;
  startTime: Date | string;
  endTime: Date | string;
  chorePlanID: number | null;
  kind: ChorePlanKind | null;
}

interface AssignmentIdentityRow {
  userID: number;
  shiftID: number;
}

interface CountRow {
  shiftID: number;
  count: string;
}

interface AssignmentChange {
  action: 'added' | 'removed';
  userID: number;
  shiftID: number;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  userID: number;
}

function timestamp(value: Date | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('A stored administrative assignment timestamp is invalid.');
  }
  return date.toISOString();
}

function mutationIDs(mutation: ChorePlanAdminAssignmentMutation): {
  shiftIDs: number[];
  userIDs: number[];
} {
  if (mutation.operation === 'assign' || mutation.operation === 'unassign') {
    return { shiftIDs: [mutation.shiftID], userIDs: [mutation.userID] };
  }
  if (mutation.operation === 'move') {
    return {
      shiftIDs: [mutation.fromShiftID, mutation.toShiftID],
      userIDs: [mutation.userID],
    };
  }
  return {
    shiftIDs: [mutation.firstShiftID, mutation.secondShiftID],
    userIDs: [mutation.firstUserID, mutation.secondUserID],
  };
}

function assignmentKey(userID: number, shiftID: number): string {
  return `${userID}:${shiftID}`;
}

function conflictMessage(rule: string): string {
  if (rule.startsWith('attendance:')) {
    return 'A destination shift is outside the participant attendance window.';
  }
  if (rule.startsWith('overlap:')) {
    return 'A destination shift overlaps another participant assignment.';
  }
  if (rule.startsWith('capacity:')) {
    return 'The proposed assignment state exceeds shift capacity.';
  }
  return 'The proposed assignment state exceeds a category requirement.';
}

export default class ChorePlanAssignmentsController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  async getView(
    rosterID: number,
  ): Promise<ChorePlanAdminAssignmentViewResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanAssignmentError('Roster not found.', 404);
      }

      const participants = (await transaction(
        'roster_participants as participant',
      )
        .innerJoin('users as user', 'user.id', 'participant.userID')
        .select(
          'participant.id',
          'participant.userID',
          'user.firstName',
          'user.lastName',
          'user.playaName',
          'participant.estimatedArrivalDate',
          'participant.estimatedDepartureDate',
        )
        .where('participant.rosterID', rosterID)
        .orderByRaw('lower(coalesce("user"."lastName", \'\'))')
        .orderByRaw('lower(coalesce("user"."firstName", \'\'))')
        .orderBy('participant.userID')
        .orderBy('participant.id')) as ParticipantRow[];
      const uniqueParticipants =
        ChorePlanAssignmentsController.uniqueParticipants(participants);

      const plan = (await transaction<PlanRow>('chore_plans')
        .select(
          'id',
          'status',
          'planningYear',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where({ rosterID })
        .first()) as PlanRow | undefined;
      if (!plan) {
        return {
          rosterID,
          plan: null,
          mutationsAllowed: false,
          participants: [],
          shifts: [],
        };
      }

      const shifts = (await transaction(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'shift.id',
          'generated.chorePlanID',
          'generated.stableKey',
          'generated.kind',
          'generated.scheduleName',
          'generated.displayDayNumber',
          'generated.displayDayLabel',
          'generated.timePeriodLabel',
          'generated.periodOrder',
          'shift.startTime',
          'shift.endTime',
          'shift.requiredParticipants',
        )
        .where('generated.chorePlanID', plan.id)
        .orderBy('generated.displayDayNumber')
        .orderBy('shift.startTime')
        .orderBy('generated.stableKey')) as GeneratedShiftRow[];
      const shiftIDs = shifts.map(({ id }) => id);
      const assignments = shiftIDs.length
        ? ((await transaction<AssignmentIdentityRow>('shift_participants')
            .select('userID', 'shiftID')
            .whereIn('shiftID', shiftIDs)
            .orderBy('userID')
            .orderBy('shiftID')) as AssignmentIdentityRow[])
        : [];
      const overrides = (await transaction<RequirementOverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .select(
          'userID',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('chorePlanID', plan.id)) as RequirementOverrideRow[];
      const overridesByUserID = new Map(
        overrides.map((override) => [override.userID, override]),
      );
      const shiftIDsByUser = new Map<number, number[]>();
      const userIDsByShift = new Map<number, number[]>();
      assignments.forEach(({ userID, shiftID }) => {
        shiftIDsByUser.set(userID, [
          ...(shiftIDsByUser.get(userID) ?? []),
          shiftID,
        ]);
        userIDsByShift.set(shiftID, [
          ...(userIDsByShift.get(shiftID) ?? []),
          userID,
        ]);
      });

      return {
        rosterID,
        plan: {
          id: plan.id,
          status: plan.status,
          planningYear: plan.planningYear,
          requirements: {
            chore: plan.choreRequirement,
            event: plan.eventRequirement,
            dinner: plan.dinnerRequirement,
          },
        },
        mutationsAllowed: plan.status === 'open',
        participants: uniqueParticipants.map((participant) =>
          ChorePlanAssignmentsController.participantView(
            participant,
            shiftIDsByUser.get(participant.userID) ?? [],
            effectiveRequirements(
              plan,
              overridesByUserID.get(participant.userID),
            ),
          ),
        ),
        shifts: shifts.map((shift): ChorePlanAdminAssignmentShift => ({
          id: shift.id,
          stableKey: shift.stableKey,
          kind: shift.kind,
          scheduleName: shift.scheduleName,
          displayDayNumber: shift.displayDayNumber,
          displayDayLabel: shift.displayDayLabel,
          timePeriodLabel: shift.timePeriodLabel,
          periodOrder: shift.periodOrder,
          startTime: timestamp(shift.startTime),
          endTime: timestamp(shift.endTime),
          requiredParticipants: shift.requiredParticipants,
          assignedUserIDs: userIDsByShift.get(shift.id) ?? [],
        })),
      };
    });
  }

  private static participantView(
    participant: ParticipantRow,
    assignedShiftIDs: number[],
    requirements: ChorePlanRequirements,
  ): ChorePlanAdminAssignmentParticipant {
    return {
      userID: participant.userID,
      firstName: participant.firstName ?? '',
      lastName: participant.lastName ?? '',
      playaName: participant.playaName ?? '',
      estimatedArrivalDate: timestamp(participant.estimatedArrivalDate),
      estimatedDepartureDate: timestamp(participant.estimatedDepartureDate),
      requirements,
      assignedShiftIDs,
    };
  }

  private static uniqueParticipants(
    participants: ParticipantRow[],
  ): ParticipantRow[] {
    // The legacy schema permits duplicate membership rows. Callers order by
    // row ID so the original registration remains authoritative.
    const byUserID = new Map<number, ParticipantRow>();
    participants.forEach((participant) => {
      if (!byUserID.has(participant.userID)) {
        byUserID.set(participant.userID, participant);
      }
    });
    return [...byUserID.values()];
  }

  async mutate(
    rosterID: number,
    actorUserID: number,
    mutation: ChorePlanAdminAssignmentMutation,
    forceReason?: string,
  ): Promise<ChorePlanAdminAssignmentMutationResponse> {
    const normalizedForceReason = forceReason?.trim();
    if (
      forceReason !== undefined &&
      (!normalizedForceReason ||
        normalizedForceReason.length > MAX_CHORE_PLAN_FORCE_REASON_LENGTH)
    ) {
      throw new ChorePlanAssignmentError('Enter a valid force reason.', 400);
    }
    const forced = normalizedForceReason !== undefined;
    const { shiftIDs, userIDs } = mutationIDs(mutation);
    const orderedShiftIDs = [...new Set(shiftIDs)].sort(
      (first, second) => first - second,
    );
    const orderedUserIDs = [...new Set(userIDs)].sort(
      (first, second) => first - second,
    );

    return this.getDatabase().transaction(async (transaction) => {
      const users = await transaction('users')
        .select('id')
        .whereIn('id', orderedUserIDs)
        .orderBy('id')
        // Serialize assignment and roster-membership changes without blocking
        // the audit foreign key's FOR KEY SHARE lock on an actor user.
        .forNoKeyUpdate();
      if (users.length !== orderedUserIDs.length) {
        throw new ChorePlanAssignmentError('Participant not found.', 404);
      }

      const plan = (await transaction<PlanRow>('chore_plans')
        .select(
          'id',
          'rosterID',
          'status',
          'planningYear',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where({ rosterID })
        .forShare()
        .first()) as PlanRow | undefined;
      if (!plan) {
        throw new ChorePlanAssignmentError('Chore plan not found.', 404);
      }
      if (plan.status !== 'open') {
        throw new ChorePlanAssignmentError(
          'Administrative assignments can change only while the plan is open.',
          409,
        );
      }

      const participants = (await transaction<ParticipantRow>(
        'roster_participants',
      )
        .select(
          'id',
          'userID',
          'estimatedArrivalDate',
          'estimatedDepartureDate',
        )
        .where({ rosterID })
        .whereIn('userID', orderedUserIDs)
        .orderBy('userID')
        .orderBy('id')
        .forUpdate()) as ParticipantRow[];
      const uniqueParticipants =
        ChorePlanAssignmentsController.uniqueParticipants(participants);
      if (uniqueParticipants.length !== orderedUserIDs.length) {
        throw new ChorePlanAssignmentError(
          'Administrative assignments are limited to roster members.',
          409,
        );
      }
      const overrides = (await transaction<RequirementOverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .select(
          'userID',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('chorePlanID', plan.id)
        .whereIn('userID', orderedUserIDs)) as RequirementOverrideRow[];
      const overridesByUserID = new Map(
        overrides.map((override) => [override.userID, override]),
      );
      const requirementsByUserID = new Map(
        orderedUserIDs.map((userID) => [
          userID,
          effectiveRequirements(plan, overridesByUserID.get(userID)),
        ]),
      );

      const shifts = (await transaction(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'shift.id',
          'generated.chorePlanID',
          'generated.stableKey',
          'generated.kind',
          'generated.scheduleName',
          'generated.displayDayLabel',
          'generated.timePeriodLabel',
          'shift.startTime',
          'shift.endTime',
          'shift.requiredParticipants',
        )
        .where('generated.chorePlanID', plan.id)
        .whereIn('shift.id', orderedShiftIDs)
        .orderBy('shift.id')
        .forUpdate('shift')) as GeneratedShiftRow[];
      if (shifts.length !== orderedShiftIDs.length) {
        throw new ChorePlanAssignmentError('Chore plan shift not found.', 404);
      }

      const existingRequested = (await transaction<AssignmentIdentityRow>(
        'shift_participants',
      )
        .select('userID', 'shiftID')
        .whereIn('userID', orderedUserIDs)
        .whereIn('shiftID', orderedShiftIDs)) as AssignmentIdentityRow[];
      const requestedKeys = new Set(
        existingRequested.map(({ userID, shiftID }) =>
          assignmentKey(userID, shiftID),
        ),
      );
      const changes = ChorePlanAssignmentsController.proposedChanges(
        mutation,
        requestedKeys,
      );
      if (changes.length === 0) {
        return { changed: false, forced, bypassedRules: [] };
      }

      const currentAssignments = (await transaction(
        'shift_participants as assignment',
      )
        .innerJoin('shifts as shift', 'shift.id', 'assignment.shiftID')
        .leftJoin(
          'chore_plan_generated_shifts as generated',
          'generated.shiftID',
          'assignment.shiftID',
        )
        .select(
          'assignment.userID',
          'assignment.shiftID',
          'shift.startTime',
          'shift.endTime',
          'generated.chorePlanID',
          'generated.kind',
        )
        .whereIn('assignment.userID', orderedUserIDs)) as AssignmentRow[];
      const finalAssignments = ChorePlanAssignmentsController.finalAssignments(
        currentAssignments,
        changes,
        shifts,
      );
      const counts = (await transaction<CountRow>('shift_participants')
        .select('shiftID')
        .count('* as count')
        .whereIn('shiftID', orderedShiftIDs)
        .groupBy('shiftID')) as CountRow[];
      const finalCounts = new Map<number, number>(
        counts.map(({ shiftID, count }) => [shiftID, Number(count)]),
      );
      changes.forEach(({ action, shiftID }) => {
        finalCounts.set(
          shiftID,
          (finalCounts.get(shiftID) ?? 0) + (action === 'added' ? 1 : -1),
        );
      });
      const bypassedRules =
        mutation.operation === 'unassign'
          ? []
          : ChorePlanAssignmentsController.validateFinalState(
              plan.id,
              requirementsByUserID,
              uniqueParticipants,
              shifts,
              finalAssignments,
              finalCounts,
              changes,
            );
      if (!forced && bypassedRules.length > 0) {
        throw new ChorePlanAssignmentError(
          conflictMessage(bypassedRules[0]),
          409,
        );
      }

      const removals = changes.filter(({ action }) => action === 'removed');
      if (removals.length > 0) {
        await transaction('shift_participants')
          .where((query) => {
            removals.forEach(({ userID, shiftID }) => {
              query.orWhere({ userID, shiftID });
            });
          })
          .del();
      }
      const additions = changes
        .filter(({ action }) => action === 'added')
        .map(({ userID, shiftID }) => ({ userID, shiftID }));
      if (additions.length > 0) {
        await transaction('shift_participants').insert(additions);
      }
      await transaction('chore_plan_audit_entries').insert({
        chorePlanID: plan.id,
        actorUserID,
        action: 'admin_assignment_mutated',
        details: {
          operation: mutation.operation,
          affectedAssignments: [...changes].sort(
            (first, second) =>
              first.action.localeCompare(second.action) ||
              first.userID - second.userID ||
              first.shiftID - second.shiftID,
          ),
          forced,
          reason: normalizedForceReason ?? null,
          bypassedRules,
        },
      });
      return { changed: true, forced, bypassedRules };
    });
  }

  private static proposedChanges(
    mutation: ChorePlanAdminAssignmentMutation,
    existing: Set<string>,
  ): AssignmentChange[] {
    if (mutation.operation === 'assign') {
      return existing.has(assignmentKey(mutation.userID, mutation.shiftID))
        ? []
        : [
            {
              action: 'added',
              userID: mutation.userID,
              shiftID: mutation.shiftID,
            },
          ];
    }
    if (mutation.operation === 'unassign') {
      return existing.has(assignmentKey(mutation.userID, mutation.shiftID))
        ? [
            {
              action: 'removed',
              userID: mutation.userID,
              shiftID: mutation.shiftID,
            },
          ]
        : [];
    }
    if (mutation.operation === 'move') {
      if (!existing.has(assignmentKey(mutation.userID, mutation.fromShiftID))) {
        throw new ChorePlanAssignmentError(
          'The participant is not assigned to the source shift.',
          409,
        );
      }
      if (existing.has(assignmentKey(mutation.userID, mutation.toShiftID))) {
        throw new ChorePlanAssignmentError(
          'The participant is already assigned to the destination shift.',
          409,
        );
      }
      return [
        {
          action: 'removed',
          userID: mutation.userID,
          shiftID: mutation.fromShiftID,
        },
        {
          action: 'added',
          userID: mutation.userID,
          shiftID: mutation.toShiftID,
        },
      ];
    }

    if (
      !existing.has(
        assignmentKey(mutation.firstUserID, mutation.firstShiftID),
      ) ||
      !existing.has(
        assignmentKey(mutation.secondUserID, mutation.secondShiftID),
      )
    ) {
      throw new ChorePlanAssignmentError(
        'Both participants must own their source shifts before a swap.',
        409,
      );
    }
    if (
      existing.has(
        assignmentKey(mutation.firstUserID, mutation.secondShiftID),
      ) ||
      existing.has(assignmentKey(mutation.secondUserID, mutation.firstShiftID))
    ) {
      throw new ChorePlanAssignmentError(
        'A participant is already assigned to the proposed destination.',
        409,
      );
    }
    return [
      {
        action: 'removed',
        userID: mutation.firstUserID,
        shiftID: mutation.firstShiftID,
      },
      {
        action: 'removed',
        userID: mutation.secondUserID,
        shiftID: mutation.secondShiftID,
      },
      {
        action: 'added',
        userID: mutation.firstUserID,
        shiftID: mutation.secondShiftID,
      },
      {
        action: 'added',
        userID: mutation.secondUserID,
        shiftID: mutation.firstShiftID,
      },
    ];
  }

  private static finalAssignments(
    current: AssignmentRow[],
    changes: AssignmentChange[],
    shifts: GeneratedShiftRow[],
  ): AssignmentRow[] {
    const rows = new Map(
      current.map((assignment) => [
        assignmentKey(assignment.userID, assignment.shiftID),
        assignment,
      ]),
    );
    const shiftsByID = new Map(shifts.map((shift) => [shift.id, shift]));
    changes.forEach((change) => {
      const key = assignmentKey(change.userID, change.shiftID);
      if (change.action === 'removed') {
        rows.delete(key);
        return;
      }
      const shift = shiftsByID.get(change.shiftID);
      if (!shift) {
        throw new Error('A locked destination shift is missing.');
      }
      rows.set(key, {
        userID: change.userID,
        shiftID: change.shiftID,
        startTime: shift.startTime,
        endTime: shift.endTime,
        chorePlanID: shift.chorePlanID,
        kind: shift.kind,
      });
    });
    return [...rows.values()];
  }

  private static validateFinalState(
    chorePlanID: number,
    requirementsByUserID: Map<number, ChorePlanRequirements>,
    participants: ParticipantRow[],
    shifts: GeneratedShiftRow[],
    assignments: AssignmentRow[],
    finalCounts: Map<number, number>,
    changes: AssignmentChange[],
  ): string[] {
    const rules = new Set<string>();
    const participantsByID = new Map(
      participants.map((participant) => [participant.userID, participant]),
    );
    const shiftsByID = new Map(shifts.map((shift) => [shift.id, shift]));
    const added = changes.filter(({ action }) => action === 'added');
    added.forEach(({ userID, shiftID }) => {
      const participant = participantsByID.get(userID);
      const shift = shiftsByID.get(shiftID);
      if (!participant || !shift) {
        throw new Error('A locked assignment validation row is missing.');
      }
      if (
        new Date(shift.startTime).getTime() <
          new Date(participant.estimatedArrivalDate).getTime() ||
        new Date(shift.endTime).getTime() >
          new Date(participant.estimatedDepartureDate).getTime()
      ) {
        rules.add(`attendance:user:${userID}:shift:${shiftID}`);
      }
      assignments
        .filter(
          (assignment) =>
            assignment.userID === userID && assignment.shiftID !== shiftID,
        )
        .forEach((assignment) => {
          if (shiftTimeRangesOverlap(shift, assignment)) {
            rules.add(
              `overlap:user:${userID}:shift:${shiftID}:with:${assignment.shiftID}`,
            );
          }
        });
    });

    shifts.forEach((shift) => {
      if ((finalCounts.get(shift.id) ?? 0) > shift.requiredParticipants) {
        rules.add(`capacity:shift:${shift.id}`);
      }
    });
    participants.forEach(({ userID }) => {
      const requirements = requirementsByUserID.get(userID);
      if (!requirements) {
        throw new Error('Participant requirements could not be loaded.');
      }
      (['chore', 'event', 'dinner'] as const).forEach((kind) => {
        const count = assignments.filter(
          (assignment) =>
            assignment.userID === userID &&
            assignment.chorePlanID === chorePlanID &&
            assignment.kind === kind,
        ).length;
        if (count > requirementForKind(requirements, kind)) {
          rules.add(`category:user:${userID}:kind:${kind}`);
        }
      });
    });
    return [...rules].sort();
  }
}
