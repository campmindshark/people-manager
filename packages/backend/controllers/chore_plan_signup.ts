import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanSignupError from '../utils/chorePlanSignupError';
import { shiftTimeRangesOverlap, ShiftTimeRange } from '../utils/shiftTime';
import { ChorePlanSignupMutationResponse } from '../view_models/chore_plan_signup';

type ChorePlanKind = 'chore' | 'event' | 'dinner';

interface PlanRow {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
}

interface ParticipantRow {
  rosterID: number;
  userID: number;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

interface GeneratedShiftRow extends ShiftTimeRange {
  id: number;
  chorePlanID: number;
  kind: ChorePlanKind;
  requiredParticipants: number;
}

interface MutationContext {
  plan: PlanRow;
  participant: ParticipantRow;
}

interface CountRow {
  count: string;
}

function requirementForKind(plan: PlanRow, kind: ChorePlanKind): number {
  if (kind === 'chore') {
    return plan.choreRequirement;
  }
  if (kind === 'event') {
    return plan.eventRequirement;
  }
  return plan.dinnerRequirement;
}

function dateMilliseconds(value: Date | string): number {
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new Error('A stored chore signup timestamp is invalid.');
  }
  return milliseconds;
}

export default class ChorePlanSignupController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  private static async loadContext(
    transaction: Knex.Transaction,
    rosterID: number,
    userID: number,
  ): Promise<MutationContext> {
    const user = await transaction('users')
      .select('id')
      .where({ id: userID })
      .forUpdate()
      .first();
    if (!user) {
      throw new ChorePlanSignupError('User not found.', 404);
    }

    const roster = await transaction('rosters')
      .select('id')
      .where({ id: rosterID })
      .first();
    if (!roster) {
      throw new ChorePlanSignupError('Roster not found.', 404);
    }

    const plan = (await transaction<PlanRow>('chore_plans')
      .select(
        'id',
        'status',
        'choreRequirement',
        'eventRequirement',
        'dinnerRequirement',
      )
      .where({ rosterID })
      .forShare()
      .first()) as PlanRow | undefined;
    if (!plan) {
      throw new ChorePlanSignupError('Chore plan not found.', 404);
    }
    if (plan.status !== 'open') {
      throw new ChorePlanSignupError(
        'Self-service chore signup is available only while the plan is open.',
        409,
      );
    }

    const participant = (await transaction<ParticipantRow>(
      'roster_participants',
    )
      .select('estimatedArrivalDate', 'estimatedDepartureDate')
      .where({ rosterID, userID })
      .forUpdate()
      .first()) as ParticipantRow | undefined;
    if (!participant) {
      throw new ChorePlanSignupError(
        'Chore plan signup is available only to roster members.',
        403,
      );
    }

    return { plan, participant };
  }

  private static async loadShifts(
    transaction: Knex.Transaction,
    chorePlanID: number,
    shiftIDs: number[],
  ): Promise<GeneratedShiftRow[]> {
    return (await transaction('chore_plan_generated_shifts as generated')
      .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
      .select(
        'shift.id',
        'generated.chorePlanID',
        'generated.kind',
        'shift.startTime',
        'shift.endTime',
        'shift.requiredParticipants',
      )
      .where('generated.chorePlanID', chorePlanID)
      .whereIn('shift.id', shiftIDs)
      .orderBy('shift.id')
      .forUpdate('shift')) as GeneratedShiftRow[];
  }

  private static validateAttendance(
    shift: GeneratedShiftRow,
    participant: ParticipantRow,
  ): void {
    if (
      dateMilliseconds(shift.startTime) <
        dateMilliseconds(participant.estimatedArrivalDate) ||
      dateMilliseconds(shift.endTime) >
        dateMilliseconds(participant.estimatedDepartureDate)
    ) {
      throw new ChorePlanSignupError(
        'This shift is outside your roster attendance window.',
        409,
      );
    }
  }

  private static async validateNoOverlap(
    transaction: Knex.Transaction,
    userID: number,
    target: GeneratedShiftRow,
    ignoredShiftID?: number,
  ): Promise<void> {
    const existingShifts = (await transaction<ShiftTimeRange>(
      'shift_participants as assignment',
    )
      .innerJoin('shifts as shift', 'shift.id', 'assignment.shiftID')
      .select('shift.startTime', 'shift.endTime')
      .where('assignment.userID', userID)
      .modify((query) => {
        if (ignoredShiftID !== undefined) {
          query.whereNot('assignment.shiftID', ignoredShiftID);
        }
      })) as ShiftTimeRange[];
    if (
      existingShifts.some((existingShift) =>
        shiftTimeRangesOverlap(target, existingShift),
      )
    ) {
      throw new ChorePlanSignupError(
        'You already have another assignment during this time block.',
        409,
      );
    }
  }

  private static async validateCategoryRequirement(
    transaction: Knex.Transaction,
    userID: number,
    plan: PlanRow,
    target: GeneratedShiftRow,
    ignoredShiftID?: number,
  ): Promise<void> {
    const assignmentCount = (await transaction(
      'shift_participants as assignment',
    )
      .innerJoin(
        'chore_plan_generated_shifts as generated',
        'generated.shiftID',
        'assignment.shiftID',
      )
      .where('assignment.userID', userID)
      .where('generated.chorePlanID', plan.id)
      .where('generated.kind', target.kind)
      .modify((query) => {
        if (ignoredShiftID !== undefined) {
          query.whereNot('assignment.shiftID', ignoredShiftID);
        }
      })
      .count('* as count')
      .first()) as CountRow | undefined;
    if (
      Number(assignmentCount?.count ?? 0) >=
      requirementForKind(plan, target.kind)
    ) {
      throw new ChorePlanSignupError(
        `You already have all required ${target.kind} assignments. Switch an existing assignment instead.`,
        409,
      );
    }
  }

  private static async validateCapacity(
    transaction: Knex.Transaction,
    shift: GeneratedShiftRow,
  ): Promise<void> {
    const participantCount = (await transaction('shift_participants')
      .where({ shiftID: shift.id })
      .count('* as count')
      .first()) as CountRow | undefined;
    if (
      Number(participantCount?.count ?? 0) >= Number(shift.requiredParticipants)
    ) {
      throw new ChorePlanSignupError('This chore plan shift is full.', 409);
    }
  }

  private static assignedShiftIDs(
    transaction: Knex.Transaction,
    userID: number,
    chorePlanID: number,
  ): Promise<number[]> {
    return transaction('shift_participants as assignment')
      .innerJoin(
        'chore_plan_generated_shifts as generated',
        'generated.shiftID',
        'assignment.shiftID',
      )
      .select('assignment.shiftID')
      .where('assignment.userID', userID)
      .where('generated.chorePlanID', chorePlanID)
      .orderBy('assignment.shiftID')
      .then((rows) => rows.map(({ shiftID }) => Number(shiftID)));
  }

  async signup(
    rosterID: number,
    shiftID: number,
    userID: number,
  ): Promise<ChorePlanSignupMutationResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const { plan, participant } = await ChorePlanSignupController.loadContext(
        transaction,
        rosterID,
        userID,
      );
      const [shift] = await ChorePlanSignupController.loadShifts(
        transaction,
        plan.id,
        [shiftID],
      );
      if (!shift) {
        throw new ChorePlanSignupError('Chore plan shift not found.', 404);
      }
      const existing = await transaction('shift_participants')
        .select('id')
        .where({ shiftID, userID })
        .first();
      if (existing) {
        return {
          changed: false,
          assignedShiftIDs: await ChorePlanSignupController.assignedShiftIDs(
            transaction,
            userID,
            plan.id,
          ),
        };
      }

      ChorePlanSignupController.validateAttendance(shift, participant);
      await ChorePlanSignupController.validateNoOverlap(
        transaction,
        userID,
        shift,
      );
      await ChorePlanSignupController.validateCategoryRequirement(
        transaction,
        userID,
        plan,
        shift,
      );
      await ChorePlanSignupController.validateCapacity(transaction, shift);
      await transaction('shift_participants').insert({ shiftID, userID });
      return {
        changed: true,
        assignedShiftIDs: await ChorePlanSignupController.assignedShiftIDs(
          transaction,
          userID,
          plan.id,
        ),
      };
    });
  }

  async remove(
    rosterID: number,
    shiftID: number,
    userID: number,
  ): Promise<ChorePlanSignupMutationResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const { plan } = await ChorePlanSignupController.loadContext(
        transaction,
        rosterID,
        userID,
      );
      const [shift] = await ChorePlanSignupController.loadShifts(
        transaction,
        plan.id,
        [shiftID],
      );
      if (!shift) {
        throw new ChorePlanSignupError('Chore plan shift not found.', 404);
      }
      const deleted = await transaction('shift_participants')
        .where({ shiftID, userID })
        .del();
      return {
        changed: deleted > 0,
        assignedShiftIDs: await ChorePlanSignupController.assignedShiftIDs(
          transaction,
          userID,
          plan.id,
        ),
      };
    });
  }

  async switch(
    rosterID: number,
    fromShiftID: number,
    toShiftID: number,
    userID: number,
  ): Promise<ChorePlanSignupMutationResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const { plan, participant } = await ChorePlanSignupController.loadContext(
        transaction,
        rosterID,
        userID,
      );
      const shifts = await ChorePlanSignupController.loadShifts(
        transaction,
        plan.id,
        [fromShiftID, toShiftID],
      );
      const source = shifts.find(({ id }) => id === fromShiftID);
      const target = shifts.find(({ id }) => id === toShiftID);
      if (!source || !target) {
        throw new ChorePlanSignupError('Chore plan shift not found.', 404);
      }
      const sourceAssignment = await transaction('shift_participants')
        .select('id')
        .where({ shiftID: fromShiftID, userID })
        .first();
      if (!sourceAssignment) {
        throw new ChorePlanSignupError(
          'You are not assigned to the source shift.',
          409,
        );
      }
      const targetAssignment = await transaction('shift_participants')
        .select('id')
        .where({ shiftID: toShiftID, userID })
        .first();
      if (targetAssignment) {
        throw new ChorePlanSignupError(
          'You are already assigned to the destination shift.',
          409,
        );
      }

      ChorePlanSignupController.validateAttendance(target, participant);
      await ChorePlanSignupController.validateNoOverlap(
        transaction,
        userID,
        target,
        fromShiftID,
      );
      await ChorePlanSignupController.validateCategoryRequirement(
        transaction,
        userID,
        plan,
        target,
        fromShiftID,
      );
      await ChorePlanSignupController.validateCapacity(transaction, target);

      await transaction('shift_participants')
        .where({ shiftID: fromShiftID, userID })
        .del();
      await transaction('shift_participants').insert({
        shiftID: toShiftID,
        userID,
      });
      return {
        changed: true,
        assignedShiftIDs: await ChorePlanSignupController.assignedShiftIDs(
          transaction,
          userID,
          plan.id,
        ),
      };
    });
  }
}
