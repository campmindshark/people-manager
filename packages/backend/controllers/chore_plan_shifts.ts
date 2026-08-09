import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanShiftViewError from '../utils/chorePlanShiftViewError';
import { shiftTimeRangesOverlap, ShiftTimeRange } from '../utils/shiftTime';
import {
  CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES,
  ChorePlanShiftViewAssignment,
  ChorePlanShiftViewConflict,
  ChorePlanShiftViewItem,
  ChorePlanShiftViewPlan,
  ChorePlanShiftViewResponse,
  ChorePlanShiftViewSlot,
} from '../view_models/chore_plan_shifts';

interface ChorePlanRow {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
  openedAt: Date | string | null;
  closedAt: Date | string | null;
}

interface GeneratedShiftRow {
  shiftID: number;
  stableKey: string;
  scheduleKey: string;
  kind: 'chore' | 'event' | 'dinner';
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

interface SlotRow {
  shiftID: number;
  definitionKey: string;
  positionLabel: string;
}

interface AssignmentRow {
  id: number;
  shiftID: number;
  userID: number;
  firstName: string | null;
  lastName: string | null;
  playaName: string | null;
}

interface ParticipantRow {
  id: number;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

interface ExistingAssignmentRow extends ShiftTimeRange {
  shiftID: number;
  scheduleName: string;
}

function dateMilliseconds(value: Date | string): number {
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new Error('A stored chore signup timestamp is invalid.');
  }
  return milliseconds;
}

function attendanceWindowContains(
  participant: ParticipantRow,
  shift: ShiftTimeRange,
): boolean {
  return (
    dateMilliseconds(shift.startTime) >=
      dateMilliseconds(participant.estimatedArrivalDate) &&
    dateMilliseconds(shift.endTime) <=
      dateMilliseconds(participant.estimatedDepartureDate)
  );
}

function signupDisplayName(assignment: AssignmentRow): string {
  const playaName = assignment.playaName?.trim();
  if (playaName) {
    return playaName;
  }
  const firstName = assignment.firstName?.trim() ?? '';
  const lastInitial = assignment.lastName?.trim().slice(0, 1) ?? '';
  const realName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
  return realName || 'Camp member';
}

function isoTimestamp(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function planView(plan: ChorePlanRow): ChorePlanShiftViewPlan {
  return {
    id: plan.id,
    rosterID: plan.rosterID,
    status: plan.status,
    planningYear: plan.planningYear,
    requirements: {
      chore: plan.choreRequirement,
      event: plan.eventRequirement,
      dinner: plan.dinnerRequirement,
    },
    openedAt: isoTimestamp(plan.openedAt),
    closedAt: isoTimestamp(plan.closedAt),
  };
}

export default class ChorePlanShiftsController {
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
  ): Promise<ChorePlanShiftViewResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );

      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanShiftViewError('Roster not found.', 404);
      }

      const participant = (await transaction('roster_participants')
        .select('id', 'estimatedArrivalDate', 'estimatedDepartureDate')
        .where({ rosterID, userID })
        .first()) as ParticipantRow | undefined;
      if (!participant) {
        throw new ChorePlanShiftViewError(
          'Chore plan shifts are available only to roster members.',
          403,
        );
      }

      const plan = (await transaction<ChorePlanRow>('chore_plans')
        .select(
          'id',
          'rosterID',
          'status',
          'planningYear',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
          'openedAt',
          'closedAt',
        )
        .where({ rosterID })
        .first()) as ChorePlanRow | undefined;

      if (!plan) {
        return {
          rosterID,
          plan: null,
          selfServiceMutationsAllowed: false,
          shifts: [],
        };
      }

      if (plan.status === 'draft') {
        return {
          rosterID,
          plan: planView(plan),
          selfServiceMutationsAllowed: false,
          shifts: [],
        };
      }

      const generatedShifts = (await transaction(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'generated.shiftID',
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
      const shiftIDs = generatedShifts.map(({ shiftID }) => shiftID);

      const slotRows = shiftIDs.length
        ? ((await transaction<SlotRow>('chore_plan_slot_snapshots')
            .select('shiftID', 'definitionKey', 'positionLabel')
            .whereIn('shiftID', shiftIDs)
            .orderBy('shiftID')
            .orderBy('slotOrder')) as SlotRow[])
        : [];
      const assignmentRows = shiftIDs.length
        ? ((await transaction<AssignmentRow>('shift_participants as assignment')
            .innerJoin('users as user', 'user.id', 'assignment.userID')
            .select(
              'assignment.id',
              'assignment.shiftID',
              'assignment.userID',
              'user.firstName',
              'user.lastName',
              'user.playaName',
            )
            .whereIn('assignment.shiftID', shiftIDs)
            .orderBy('assignment.shiftID')
            .orderBy('assignment.id')) as AssignmentRow[])
        : [];
      const existingAssignments = (await transaction<ExistingAssignmentRow>(
        'shift_participants as assignment',
      )
        .innerJoin('shifts as shift', 'shift.id', 'assignment.shiftID')
        .innerJoin('schedules as schedule', 'schedule.id', 'shift.scheduleID')
        .select(
          'assignment.shiftID',
          'schedule.name as scheduleName',
          'shift.startTime',
          'shift.endTime',
        )
        .where('assignment.userID', userID)
        .orderBy('shift.startTime')
        .orderBy('assignment.shiftID')) as ExistingAssignmentRow[];

      const slotsByShiftID = new Map<number, ChorePlanShiftViewSlot[]>();
      slotRows.forEach((slot) => {
        const slots = slotsByShiftID.get(slot.shiftID) ?? [];
        slots.push({
          definitionKey: slot.definitionKey,
          positionLabel: slot.positionLabel,
        });
        slotsByShiftID.set(slot.shiftID, slots);
      });
      const assignmentsByShiftID = new Map<
        number,
        ChorePlanShiftViewAssignment[]
      >();
      assignmentRows.forEach((assignment) => {
        const assignments = assignmentsByShiftID.get(assignment.shiftID) ?? [];
        assignments.push({
          displayName: signupDisplayName(assignment),
          currentUser: Number(assignment.userID) === Number(userID),
        });
        assignmentsByShiftID.set(assignment.shiftID, assignments);
      });

      const shifts: ChorePlanShiftViewItem[] = generatedShifts.map((shift) => {
        const assignments = assignmentsByShiftID.get(shift.shiftID) ?? [];
        const currentUserAssigned = assignments.some(
          ({ currentUser }) => currentUser,
        );
        let signupRestrictionReason: string | null = null;
        let signupConflictShiftIDs: number[] = [];
        let signupConflicts: ChorePlanShiftViewConflict[] = [];
        if (!currentUserAssigned) {
          if (!attendanceWindowContains(participant, shift)) {
            signupRestrictionReason =
              CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.outsideAttendanceWindow;
          } else {
            signupConflicts = existingAssignments
              .filter(
                (existingAssignment) =>
                  existingAssignment.shiftID !== shift.shiftID &&
                  shiftTimeRangesOverlap(shift, existingAssignment),
              )
              .map(({ shiftID, scheduleName, startTime, endTime }) => ({
                shiftID: Number(shiftID),
                scheduleName,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
              }));
            signupConflictShiftIDs = signupConflicts.map(
              ({ shiftID }) => shiftID,
            );
            if (signupConflicts.length > 0) {
              signupRestrictionReason =
                CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict;
            }
          }
        }
        return {
          id: shift.shiftID,
          stableKey: shift.stableKey,
          scheduleKey: shift.scheduleKey,
          kind: shift.kind,
          scheduleName: shift.scheduleName,
          displayDayNumber: shift.displayDayNumber,
          displayDayLabel: shift.displayDayLabel,
          calendarDay: shift.calendarDay,
          timePeriodLabel: shift.timePeriodLabel,
          periodOrder: shift.periodOrder,
          startTime: new Date(shift.startTime).toISOString(),
          endTime: new Date(shift.endTime).toISOString(),
          requiredParticipants: shift.requiredParticipants,
          assignedParticipantCount: assignments.length,
          currentUserAssigned,
          signupRestrictionReason,
          signupConflictShiftIDs,
          signupConflicts,
          assignments,
          slots: slotsByShiftID.get(shift.shiftID) ?? [],
        };
      });

      return {
        rosterID,
        plan: planView(plan),
        selfServiceMutationsAllowed: plan.status === 'open',
        shifts,
      };
    });
  }
}
