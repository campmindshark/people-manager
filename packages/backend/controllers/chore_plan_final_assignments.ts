import { Knex } from 'knex';
import {
  CHORE_PLAN_KINDS,
  ChorePlanKind,
  ChorePlanStatus,
} from '../domain/chore_planning';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanFinalAssignmentsError from '../utils/chorePlanFinalAssignmentsError';
import {
  ChorePlanFinalAssignmentParticipant,
  ChorePlanFinalAssignmentsResponse,
} from '../view_models/chore_plan_final_assignments';

interface PlanRow {
  id: number;
  status: ChorePlanStatus;
  planningYear: number;
  closedAt: Date | string | null;
}

interface GeneratedShiftRow {
  id: number;
  stableKey: string;
  scheduleKey: string;
  kind: ChorePlanKind;
  scheduleName: string;
  displayDayNumber: number;
  displayDayLabel: string;
  calendarDay: number;
  timePeriodLabel: string;
  periodOrder: number | null;
  startTime: Date | string;
  endTime: Date | string;
  requiredParticipants: number;
}

interface AssignmentRow {
  shiftID: number;
  userID: number;
  firstName: string | null;
  lastName: string | null;
  playaName: string | null;
}

interface NamedAssignment extends ChorePlanFinalAssignmentParticipant {
  userID: number;
}

function displayName(assignment: AssignmentRow): string {
  const firstName = String(assignment.firstName ?? '').trim();
  const lastInitial = String(assignment.lastName ?? '')
    .trim()
    .slice(0, 1);
  const legalName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
  const playaName = String(assignment.playaName ?? '').trim();
  if (playaName && legalName) {
    return `${playaName} (${legalName})`;
  }
  return playaName || legalName || 'Participant';
}

function normalizedName(value: string): string {
  return value.normalize('NFKD').toLowerCase();
}

function compareAssignments(
  first: NamedAssignment,
  second: NamedAssignment,
): number {
  const firstName = normalizedName(first.displayName);
  const secondName = normalizedName(second.displayName);
  if (firstName < secondName) {
    return -1;
  }
  if (firstName > secondName) {
    return 1;
  }
  return first.userID - second.userID;
}

function isoTimestamp(value: Date | string, field: string): string {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error(`Stored final assignment ${field} is invalid.`);
  }
  return timestamp.toISOString();
}

export default class ChorePlanFinalAssignmentsController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  async getForUser(
    rosterID: number,
    userID: number,
  ): Promise<ChorePlanFinalAssignmentsResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );

      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanFinalAssignmentsError('Roster not found.', 404);
      }

      const participant = await transaction('roster_participants')
        .select('id')
        .where({ rosterID, userID })
        .first();
      if (!participant) {
        throw new ChorePlanFinalAssignmentsError(
          'Final assignments are available only to roster members.',
          403,
        );
      }

      const plan = (await transaction<PlanRow>('chore_plans')
        .select('id', 'status', 'planningYear', 'closedAt')
        .where('rosterID', rosterID)
        .first()) as PlanRow | undefined;
      if (!plan) {
        throw new ChorePlanFinalAssignmentsError(
          'Final assignments are unavailable because no chore plan exists.',
          404,
        );
      }
      if (plan.status !== 'closed' || plan.closedAt === null) {
        throw new ChorePlanFinalAssignmentsError(
          'Final assignments are available after chore signups close.',
          409,
        );
      }

      const generatedShifts = (await transaction(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'shift.id',
          'generated.stableKey',
          'generated.scheduleKey',
          'generated.kind',
          'generated.scheduleName',
          'generated.displayDayNumber',
          'generated.displayDayLabel',
          'generated.calendarDay',
          'generated.timePeriodLabel',
          'generated.periodOrder',
          'shift.startTime',
          'shift.endTime',
          'shift.requiredParticipants',
        )
        .where('generated.chorePlanID', plan.id)
        .orderBy('generated.displayDayNumber')
        .orderBy('shift.startTime')
        .orderBy('generated.scheduleKey')
        .orderBy('generated.stableKey')) as GeneratedShiftRow[];
      const shiftIDs = generatedShifts.map(({ id }) => Number(id));
      const assignments = shiftIDs.length
        ? ((await transaction('shift_participants as assignment')
            .innerJoin('users as user', 'user.id', 'assignment.userID')
            .select(
              'assignment.shiftID',
              'assignment.userID',
              'user.firstName',
              'user.lastName',
              'user.playaName',
            )
            .whereIn('assignment.shiftID', shiftIDs)
            .orderBy('assignment.shiftID')
            .orderBy('assignment.userID')) as AssignmentRow[])
        : [];

      const assignmentsByShiftID = new Map<number, NamedAssignment[]>();
      assignments.forEach((assignment) => {
        const shiftID = Number(assignment.shiftID);
        assignmentsByShiftID.set(shiftID, [
          ...(assignmentsByShiftID.get(shiftID) ?? []),
          {
            userID: Number(assignment.userID),
            displayName: displayName(assignment),
            currentUser: Number(assignment.userID) === userID,
          },
        ]);
      });

      const categories = CHORE_PLAN_KINDS.map((kind) => ({
        kind,
        shifts: generatedShifts
          .filter((shift) => shift.kind === kind)
          .map((shift) => ({
            id: Number(shift.id),
            stableKey: shift.stableKey,
            kind,
            scheduleName: shift.scheduleName,
            displayDayNumber: Number(shift.displayDayNumber),
            displayDayLabel: shift.displayDayLabel,
            calendarDay: Number(shift.calendarDay),
            timePeriodLabel: shift.timePeriodLabel,
            periodOrder:
              shift.periodOrder === null ? null : Number(shift.periodOrder),
            startTime: isoTimestamp(shift.startTime, 'start time'),
            endTime: isoTimestamp(shift.endTime, 'end time'),
            requiredParticipants: Number(shift.requiredParticipants),
            participants: (assignmentsByShiftID.get(Number(shift.id)) ?? [])
              .sort(compareAssignments)
              .map(({ displayName: name, currentUser }) => ({
                displayName: name,
                currentUser,
              })),
          })),
      }));

      return {
        rosterID,
        planID: Number(plan.id),
        status: 'closed',
        planningYear: Number(plan.planningYear),
        closedAt: isoTimestamp(plan.closedAt, 'closure time'),
        assignmentCount: assignments.length,
        categories,
      };
    });
  }
}
