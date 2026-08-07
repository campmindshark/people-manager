import { Knex } from 'knex';
import { ChorePlanStatus } from '../domain/chore_planning';
import {
  ChorePlanRequirementColumns,
  effectiveRequirements,
} from '../utils/chorePlanRequirements';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';

interface PlanRow extends ChorePlanRequirementColumns {
  id: number;
  status: ChorePlanStatus;
}

interface OverrideRow extends ChorePlanRequirementColumns {
  reason: string;
}

interface CountRow {
  kind: 'chore' | 'event' | 'dinner';
  shiftCount: string;
}

export interface ChorePlanParticipantSignupStatus {
  chorePlanStatus: ChorePlanStatus;
  choreSignupsOpen: boolean;
  requirements: ChorePlanRequirements;
  hasCustomRequirements: boolean;
  requirementExceptionReason: string | null;
  choreShiftCount: number;
  eventShiftCount: number;
  dinnerShiftCount: number;
  shiftCount: number;
}

export async function loadChorePlanParticipantSignupStatus(
  database: Knex,
  userID: number,
  rosterID: number,
): Promise<ChorePlanParticipantSignupStatus | null> {
  return database.transaction(async (transaction) => {
    await transaction.raw(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
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
      return null;
    }

    const requirementOverride = (await transaction<OverrideRow>(
      'chore_plan_requirement_overrides',
    )
      .select(
        'choreRequirement',
        'eventRequirement',
        'dinnerRequirement',
        'reason',
      )
      .where('chorePlanID', plan.id)
      .where('userID', userID)
      .first()) as OverrideRow | undefined;
    const countRows = (await transaction('shift_participants as assignment')
      .innerJoin(
        'chore_plan_generated_shifts as generated',
        'generated.shiftID',
        'assignment.shiftID',
      )
      .select('generated.kind')
      .countDistinct('assignment.shiftID as shiftCount')
      .where('generated.chorePlanID', plan.id)
      .where('assignment.userID', userID)
      .groupBy('generated.kind')) as CountRow[];
    const counts = { chore: 0, event: 0, dinner: 0 };
    countRows.forEach(({ kind, shiftCount }) => {
      counts[kind] = Number(shiftCount);
    });

    return {
      chorePlanStatus: plan.status,
      choreSignupsOpen: plan.status === 'open',
      requirements: effectiveRequirements(plan, requirementOverride),
      hasCustomRequirements: requirementOverride !== undefined,
      requirementExceptionReason: requirementOverride?.reason ?? null,
      choreShiftCount: counts.chore,
      eventShiftCount: counts.event,
      dinnerShiftCount: counts.dinner,
      shiftCount: counts.chore + counts.event + counts.dinner,
    };
  });
}
