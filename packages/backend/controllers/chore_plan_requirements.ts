import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanRequirementError from '../utils/chorePlanRequirementError';
import {
  effectiveRequirements,
  requirementsFromColumns,
  requirementsToColumns,
  ChorePlanRequirementColumns,
} from '../utils/chorePlanRequirements';
import {
  ChorePlanParticipantRequirements,
  ChorePlanRequirementOverrideMutationResponse,
  ChorePlanRequirementOverrideRequest,
  ChorePlanRequirementOverrideViewResponse,
} from '../view_models/chore_plan_requirements';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';

interface PlanRow extends ChorePlanRequirementColumns {
  id: number;
  status: 'draft' | 'open' | 'closed';
}

interface ParticipantRow {
  userID: number;
  firstName: string | null;
  lastName: string | null;
  playaName: string | null;
}

interface OverrideRow extends ChorePlanRequirementColumns {
  userID: number;
  reason: string;
}

interface AssignmentRow {
  assignmentID: number;
  shiftID: number;
  stableKey: string;
  kind: 'chore' | 'event' | 'dinner';
}

interface RemovedAssignment {
  shiftID: number;
  stableKey: string;
  kind: 'chore' | 'event' | 'dinner';
}

interface MutationContext {
  plan: PlanRow;
  planRequirements: ChorePlanRequirements;
  participant: ParticipantRow;
  existingOverride?: OverrideRow;
}

function requirementsEqual(
  first: ChorePlanRequirements,
  second: ChorePlanRequirements,
): boolean {
  return (['chore', 'event', 'dinner'] as const).every(
    (kind) => first[kind] === second[kind],
  );
}

function uniqueParticipants(participants: ParticipantRow[]): ParticipantRow[] {
  // The legacy schema permits duplicate membership rows. The user identity and
  // profile fields are shared, so retain the first row from the sorted query.
  const byUserID = new Map<number, ParticipantRow>();
  participants.forEach((participant) => {
    if (!byUserID.has(participant.userID)) {
      byUserID.set(participant.userID, participant);
    }
  });
  return [...byUserID.values()];
}

function participantView(
  participant: ParticipantRow,
  plan: PlanRow,
  override?: OverrideRow,
): ChorePlanParticipantRequirements {
  return {
    userID: participant.userID,
    firstName: participant.firstName ?? '',
    lastName: participant.lastName ?? '',
    playaName: participant.playaName ?? '',
    requirements: effectiveRequirements(plan, override),
    hasOverride: override !== undefined,
    overrideReason: override?.reason ?? null,
  };
}

export default class ChorePlanRequirementsController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  async getView(
    rosterID: number,
  ): Promise<ChorePlanRequirementOverrideViewResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanRequirementError('Roster not found.', 404);
      }

      const plan = (await transaction<PlanRow>('chore_plans')
        .select(
          'id',
          'status',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('rosterID', rosterID)
        .first()) as PlanRow | undefined;
      if (!plan) {
        return {
          rosterID,
          plan: null,
          mutationsAllowed: false,
          participants: [],
        };
      }

      const participants = (await transaction(
        'roster_participants as participant',
      )
        .innerJoin('users as user', 'user.id', 'participant.userID')
        .select(
          'participant.userID',
          'user.firstName',
          'user.lastName',
          'user.playaName',
        )
        .where('participant.rosterID', rosterID)
        .orderByRaw('lower(coalesce("user"."lastName", \'\'))')
        .orderByRaw('lower(coalesce("user"."firstName", \'\'))')
        .orderBy('participant.userID')) as ParticipantRow[];
      const overrides = (await transaction<OverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .select(
          'userID',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
          'reason',
        )
        .where('chorePlanID', plan.id)) as OverrideRow[];
      const overridesByUserID = new Map(
        overrides.map((override) => [override.userID, override]),
      );
      const planRequirements = requirementsFromColumns(plan);

      return {
        rosterID,
        plan: {
          id: plan.id,
          status: plan.status,
          requirements: planRequirements,
        },
        mutationsAllowed: plan.status !== 'closed',
        participants: uniqueParticipants(participants).map((participant) =>
          participantView(
            participant,
            plan,
            overridesByUserID.get(participant.userID),
          ),
        ),
      };
    });
  }

  private static async loadMutationContext(
    transaction: Knex.Transaction,
    rosterID: number,
    userID: number,
    actorUserID: number,
  ): Promise<MutationContext> {
    const roster = await transaction('rosters')
      .select('id')
      .where({ id: rosterID })
      .first();
    if (!roster) {
      throw new ChorePlanRequirementError('Roster not found.', 404);
    }
    const plan = (await transaction<PlanRow>('chore_plans')
      .select(
        'id',
        'status',
        'choreRequirement',
        'eventRequirement',
        'dinnerRequirement',
      )
      .where('rosterID', rosterID)
      .forUpdate()
      .first()) as PlanRow | undefined;
    if (!plan) {
      throw new ChorePlanRequirementError('Chore plan not found.', 404);
    }
    if (plan.status === 'closed') {
      throw new ChorePlanRequirementError(
        'Participant requirements cannot change while the plan is closed.',
        409,
      );
    }

    // Signup and lifecycle transitions lock the plan before user rows. Keep
    // that order here while taking the audit foreign key's FOR KEY SHARE lock.
    const actor = await transaction('users')
      .select('id')
      .where({ id: actorUserID })
      .forKeyShare()
      .first();
    if (!actor) {
      throw new ChorePlanRequirementError('User not found.', 404);
    }

    const participant = (await transaction('roster_participants as participant')
      .innerJoin('users as user', 'user.id', 'participant.userID')
      .select(
        'participant.userID',
        'user.firstName',
        'user.lastName',
        'user.playaName',
      )
      .where('participant.rosterID', rosterID)
      .where('participant.userID', userID)
      .forUpdate('participant')
      .first()) as ParticipantRow | undefined;
    if (!participant) {
      throw new ChorePlanRequirementError('Roster participant not found.', 404);
    }
    const existingOverride = (await transaction<OverrideRow>(
      'chore_plan_requirement_overrides',
    )
      .select(
        'userID',
        'choreRequirement',
        'eventRequirement',
        'dinnerRequirement',
        'reason',
      )
      .where('chorePlanID', plan.id)
      .where('userID', userID)
      .forUpdate()
      .first()) as OverrideRow | undefined;
    return {
      plan,
      planRequirements: requirementsFromColumns(plan),
      participant,
      existingOverride,
    };
  }

  private static async reconcileReducedRequirements(
    transaction: Knex.Transaction,
    chorePlanID: number,
    userID: number,
    previousRequirements: ChorePlanRequirements,
    requirements: ChorePlanRequirements,
  ): Promise<RemovedAssignment[]> {
    const reducedKinds = (['chore', 'event', 'dinner'] as const).filter(
      (kind) => requirements[kind] < previousRequirements[kind],
    );
    if (reducedKinds.length === 0) {
      return [];
    }

    const assignments = (await transaction<AssignmentRow>(
      'shift_participants as assignment',
    )
      .innerJoin(
        'chore_plan_generated_shifts as generated',
        'generated.shiftID',
        'assignment.shiftID',
      )
      .select(
        'assignment.id as assignmentID',
        'assignment.shiftID',
        'generated.stableKey',
        'generated.kind',
      )
      .where('assignment.userID', userID)
      .where('generated.chorePlanID', chorePlanID)
      .whereIn('generated.kind', reducedKinds)
      .orderBy('generated.kind')
      .orderBy('assignment.id')
      .forUpdate('assignment')) as AssignmentRow[];
    const retainedByKind = new Map<AssignmentRow['kind'], number>();
    const removedRows = assignments.filter((assignment) => {
      const retained = retainedByKind.get(assignment.kind) ?? 0;
      if (retained < requirements[assignment.kind]) {
        retainedByKind.set(assignment.kind, retained + 1);
        return false;
      }
      return true;
    });
    if (removedRows.length > 0) {
      await transaction('shift_participants')
        .whereIn(
          'id',
          removedRows.map(({ assignmentID }) => assignmentID),
        )
        .del();
    }
    return removedRows.map(({ shiftID, stableKey, kind }) => ({
      shiftID,
      stableKey,
      kind,
    }));
  }

  async setOverride(
    rosterID: number,
    userID: number,
    request: ChorePlanRequirementOverrideRequest,
    actorUserID: number,
  ): Promise<ChorePlanRequirementOverrideMutationResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const context = await ChorePlanRequirementsController.loadMutationContext(
        transaction,
        rosterID,
        userID,
        actorUserID,
      );
      (['chore', 'event', 'dinner'] as const).forEach((kind) => {
        if (request.requirements[kind] > context.planRequirements[kind]) {
          throw new ChorePlanRequirementError(
            `${kind[0].toUpperCase()}${kind.slice(
              1,
            )} requirements may not exceed the plan value of ${context.planRequirements[kind]}.`,
            400,
          );
        }
      });
      if (requirementsEqual(request.requirements, context.planRequirements)) {
        throw new ChorePlanRequirementError(
          'At least one override must be below the plan requirements. Clear the override to use plan defaults.',
          400,
        );
      }

      const previousRequirements = effectiveRequirements(
        context.plan,
        context.existingOverride,
      );
      if (
        requirementsEqual(previousRequirements, request.requirements) &&
        context.existingOverride?.reason === request.reason
      ) {
        return {
          changed: false,
          participant: participantView(
            context.participant,
            context.plan,
            context.existingOverride,
          ),
        };
      }

      const removedAssignments =
        await ChorePlanRequirementsController.reconcileReducedRequirements(
          transaction,
          context.plan.id,
          userID,
          previousRequirements,
          request.requirements,
        );
      const columns = requirementsToColumns(request.requirements);
      await transaction('chore_plan_requirement_overrides')
        .insert({
          chorePlanID: context.plan.id,
          userID,
          ...columns,
          reason: request.reason,
        })
        .onConflict(['chorePlanID', 'userID'])
        .merge({
          ...columns,
          reason: request.reason,
          updatedAt: transaction.fn.now(),
        });
      await transaction('chore_plan_audit_entries').insert({
        chorePlanID: context.plan.id,
        actorUserID,
        action: 'participant_requirements_overridden',
        details: {
          participantUserID: userID,
          previousRequirements,
          requirements: request.requirements,
          previousReason: context.existingOverride?.reason ?? null,
          reason: request.reason,
          removedAssignments,
        },
      });
      return {
        changed: true,
        participant: participantView(context.participant, context.plan, {
          userID,
          ...columns,
          reason: request.reason,
        }),
      };
    });
  }

  async clearOverride(
    rosterID: number,
    userID: number,
    reason: string,
    actorUserID: number,
  ): Promise<ChorePlanRequirementOverrideMutationResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const context = await ChorePlanRequirementsController.loadMutationContext(
        transaction,
        rosterID,
        userID,
        actorUserID,
      );
      if (!context.existingOverride) {
        return {
          changed: false,
          participant: participantView(context.participant, context.plan),
        };
      }
      const previousRequirements = effectiveRequirements(
        context.plan,
        context.existingOverride,
      );
      await transaction('chore_plan_requirement_overrides')
        .where({ chorePlanID: context.plan.id, userID })
        .del();
      await transaction('chore_plan_audit_entries').insert({
        chorePlanID: context.plan.id,
        actorUserID,
        action: 'participant_requirements_cleared',
        details: {
          participantUserID: userID,
          previousRequirements,
          requirements: context.planRequirements,
          previousReason: context.existingOverride.reason,
          reason,
          removedAssignments: [],
        },
      });
      return {
        changed: true,
        participant: participantView(context.participant, context.plan),
      };
    });
  }
}
