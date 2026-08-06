import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanLifecycleError from '../utils/chorePlanLifecycleError';
import { MAX_CHORE_PLAN_REOPEN_REASON_LENGTH } from '../utils/chorePlanLifecycleInput';
import {
  ChorePlanLifecycleResponse,
  ChorePlanLifecycleState,
} from '../view_models/chore_plan_lifecycle';

type LifecycleAction = 'open' | 'close' | 'reopen';

interface ChorePlanLifecycleRow {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  camperCount: number;
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
  openedAt: Date | string | null;
  openedByUserID: number | null;
  closedAt: Date | string | null;
  closedByUserID: number | null;
  updatedAt: Date | string;
}

interface TransitionTimeRow {
  transitionedAt: Date | string;
}

interface CountRow {
  count: string;
}

interface LifecycleCounts {
  shiftCount: number;
  slotCount: number;
}

interface TransitionContract {
  fromStatus: ChorePlanLifecycleRow['status'];
  toStatus: ChorePlanLifecycleRow['status'];
  auditAction: 'plan_opened' | 'plan_closed' | 'plan_reopened';
}

const TRANSITIONS: Record<LifecycleAction, TransitionContract> = {
  open: {
    fromStatus: 'draft',
    toStatus: 'open',
    auditAction: 'plan_opened',
  },
  close: {
    fromStatus: 'open',
    toStatus: 'closed',
    auditAction: 'plan_closed',
  },
  reopen: {
    fromStatus: 'closed',
    toStatus: 'open',
    auditAction: 'plan_reopened',
  },
};

function timestamp(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

async function loadLifecycleCounts(
  database: Knex,
  chorePlanID: number,
): Promise<LifecycleCounts> {
  const [shiftCount, slotCount] = await Promise.all([
    database('chore_plan_generated_shifts')
      .where({ chorePlanID })
      .count('* as count')
      .first() as Promise<CountRow | undefined>,
    database('chore_plan_slot_snapshots as slot')
      .innerJoin(
        'chore_plan_generated_shifts as generated',
        'generated.shiftID',
        'slot.shiftID',
      )
      .where('generated.chorePlanID', chorePlanID)
      .count('* as count')
      .first() as Promise<CountRow | undefined>,
  ]);
  return {
    shiftCount: Number(shiftCount?.count ?? 0),
    slotCount: Number(slotCount?.count ?? 0),
  };
}

function lifecycleState(
  plan: ChorePlanLifecycleRow,
  counts: LifecycleCounts,
): ChorePlanLifecycleState {
  return {
    id: plan.id,
    rosterID: plan.rosterID,
    status: plan.status,
    planningYear: plan.planningYear,
    camperCount: plan.camperCount,
    requirements: {
      chore: plan.choreRequirement,
      event: plan.eventRequirement,
      dinner: plan.dinnerRequirement,
    },
    shiftCount: counts.shiftCount,
    slotCount: counts.slotCount,
    openedAt: timestamp(plan.openedAt),
    openedByUserID: plan.openedByUserID,
    closedAt: timestamp(plan.closedAt),
    closedByUserID: plan.closedByUserID,
    updatedAt: new Date(plan.updatedAt).toISOString(),
  };
}

function invalidTransitionMessage(action: LifecycleAction): string {
  if (action === 'open') {
    return 'Only a draft chore plan can be opened.';
  }
  if (action === 'close') {
    return 'Only an open chore plan can be closed.';
  }
  return 'Only a closed chore plan can be reopened.';
}

export default class ChorePlanLifecycleController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  async getByRosterID(rosterID: number): Promise<ChorePlanLifecycleResponse> {
    const database = this.getDatabase();
    const plan = (await database<ChorePlanLifecycleRow>('chore_plans')
      .where({ rosterID })
      .first()) as ChorePlanLifecycleRow | undefined;
    if (!plan) {
      return { plan: null };
    }
    return {
      plan: lifecycleState(plan, await loadLifecycleCounts(database, plan.id)),
    };
  }

  async open(
    rosterID: number,
    actorUserID: number,
  ): Promise<ChorePlanLifecycleState> {
    return this.transition(rosterID, actorUserID, 'open');
  }

  async close(
    rosterID: number,
    actorUserID: number,
  ): Promise<ChorePlanLifecycleState> {
    return this.transition(rosterID, actorUserID, 'close');
  }

  async reopen(
    rosterID: number,
    actorUserID: number,
    reason: string,
  ): Promise<ChorePlanLifecycleState> {
    const normalizedReason = reason.trim();
    if (
      normalizedReason.length === 0 ||
      normalizedReason.length > MAX_CHORE_PLAN_REOPEN_REASON_LENGTH
    ) {
      throw new ChorePlanLifecycleError('Enter a valid reopening reason.', 400);
    }
    return this.transition(rosterID, actorUserID, 'reopen', normalizedReason);
  }

  private async transition(
    rosterID: number,
    actorUserID: number,
    action: LifecycleAction,
    reason?: string,
  ): Promise<ChorePlanLifecycleState> {
    const contract = TRANSITIONS[action];
    return this.getDatabase().transaction(async (transaction) => {
      const plan = (await transaction<ChorePlanLifecycleRow>('chore_plans')
        .where({ rosterID })
        .forUpdate()
        .first()) as ChorePlanLifecycleRow | undefined;
      if (!plan) {
        throw new ChorePlanLifecycleError('Chore plan not found.', 404);
      }
      if (plan.status !== contract.fromStatus) {
        throw new ChorePlanLifecycleError(
          invalidTransitionMessage(action),
          409,
        );
      }

      const timeResult = (await transaction.raw(
        'SELECT CURRENT_TIMESTAMP AS "transitionedAt"',
      )) as { rows: TransitionTimeRow[] };
      const transitionedAt = new Date(timeResult.rows[0].transitionedAt);
      const update = {
        status: contract.toStatus,
        updatedAt: transitionedAt,
        ...(action === 'close'
          ? {
              closedAt: transitionedAt,
              closedByUserID: actorUserID,
            }
          : {
              openedAt: transitionedAt,
              openedByUserID: actorUserID,
              closedAt: null,
              closedByUserID: null,
            }),
      };
      const [updated] = (await transaction<ChorePlanLifecycleRow>('chore_plans')
        .where({ id: plan.id })
        .update(update)
        .returning('*')) as ChorePlanLifecycleRow[];

      await transaction('chore_plan_audit_entries').insert({
        chorePlanID: plan.id,
        actorUserID,
        action: contract.auditAction,
        details:
          action === 'reopen'
            ? {
                fromStatus: contract.fromStatus,
                toStatus: contract.toStatus,
                reason,
              }
            : {
                fromStatus: contract.fromStatus,
                toStatus: contract.toStatus,
              },
        createdAt: transitionedAt,
      });

      return lifecycleState(
        updated,
        await loadLifecycleCounts(transaction, updated.id),
      );
    });
  }
}
