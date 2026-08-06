import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanLifecycleError from '../utils/chorePlanLifecycleError';
import { MAX_CHORE_PLAN_REOPEN_REASON_LENGTH } from '../utils/chorePlanLifecycleInput';
import { ChorePlanLifecycleState } from '../view_models/chore_plan_lifecycle';

type LifecycleAction = 'open' | 'close' | 'reopen';

interface ChorePlanLifecycleRow {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  openedAt: Date | string | null;
  openedByUserID: number | null;
  closedAt: Date | string | null;
  closedByUserID: number | null;
  updatedAt: Date | string;
}

interface TransitionTimeRow {
  transitionedAt: Date | string;
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

function lifecycleState(plan: ChorePlanLifecycleRow): ChorePlanLifecycleState {
  return {
    id: plan.id,
    rosterID: plan.rosterID,
    status: plan.status,
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

      return lifecycleState(updated);
    });
  }
}
