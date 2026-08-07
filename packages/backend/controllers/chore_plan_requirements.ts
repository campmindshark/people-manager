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
        participants: participants.map((participant) =>
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

      const previousRequirements = context.existingOverride
        ? effectiveRequirements(context.plan, context.existingOverride)
        : null;
      if (
        previousRequirements &&
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
        },
      });
      return {
        changed: true,
        participant: participantView(context.participant, context.plan),
      };
    });
  }
}
