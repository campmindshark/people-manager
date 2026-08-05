import Knex from 'knex';
import knexConfig from '../knexfile';
import {
  CHORE_PLAN_KINDS,
  ChorePlanKind,
  ChorePlanReadiness,
  ChorePlanReadinessShift,
  ChorePlanRequirements,
} from '../view_models/chore_plan';
import { getConfig } from '../config/config';
import ChorePlanError from '../utils/chorePlanError';
import {
  shiftTimeRangeContains,
  shiftTimeRangesOverlap,
} from '../utils/shiftTime';
import {
  ChorePlanRequirementColumns,
  effectiveRequirements,
  requirementsFromColumns,
} from '../utils/chorePlanRequirements';

const knex = Knex(knexConfig[getConfig().Environment]);

interface ReadinessPlanRow extends ChorePlanRequirementColumns {
  id: number;
  rosterID: number;
  camperCount: number;
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
}

interface ReadinessMemberRow {
  userID: number;
  firstName: string;
  lastName: string;
  playaName: string | null;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

interface ReadinessShiftRow {
  shiftID: number;
  scheduleName: string;
  schedulePlannerKey: string | null;
  startTime: Date | string;
  endTime: Date | string;
  requiredParticipants: number;
}

interface ReadinessAssignmentRow {
  shiftID: number;
  userID: number;
  schedulePlannerKey: string | null;
  startTime: Date | string;
  endTime: Date | string;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  userID: number;
  firstName: string;
  lastName: string;
  playaName: string | null;
  reason: string;
}

function chorePlanKind(plannerKey: string | null): ChorePlanKind | null {
  const kind = String(plannerKey ?? '').split('|')[0];
  return CHORE_PLAN_KINDS.includes(kind as ChorePlanKind)
    ? (kind as ChorePlanKind)
    : null;
}

function signupName(person: {
  firstName: string;
  lastName: string;
  playaName: string | null;
}): string {
  const firstName = String(person.firstName ?? '').trim();
  const lastInitial = String(person.lastName ?? '')
    .trim()
    .slice(0, 1);
  const realName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
  const playaName = String(person.playaName ?? '').trim();
  return playaName ? `${playaName} (${realName})` : realName;
}

function isoDate(value: Date | string): string {
  return new Date(value).toISOString();
}

export default class ChorePlanReadinessController {
  public static async GetByRosterID(
    rosterID: number,
  ): Promise<ChorePlanReadiness> {
    const plan = await knex<ReadinessPlanRow>('chore_plans')
      .select(
        'id',
        'rosterID',
        'camperCount',
        'choreRequirement',
        'eventRequirement',
        'dinnerRequirement',
      )
      .where('rosterID', rosterID)
      .first();
    if (!plan) {
      throw new ChorePlanError(
        'Create the chore plan before reviewing readiness.',
        404,
      );
    }

    const [members, shifts, requirementOverrides] = await Promise.all([
      knex<ReadinessMemberRow>('roster_participants')
        .join('users', 'roster_participants.userID', '=', 'users.id')
        .select(
          'roster_participants.userID',
          'roster_participants.estimatedArrivalDate',
          'roster_participants.estimatedDepartureDate',
          'users.firstName',
          'users.lastName',
          'users.playaName',
        )
        .where('roster_participants.rosterID', rosterID),
      knex<ReadinessShiftRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shifts.id as shiftID',
          'shifts.startTime',
          'shifts.endTime',
          'shifts.requiredParticipants',
          'schedules.name as scheduleName',
          'schedules.plannerKey as schedulePlannerKey',
        )
        .where('schedules.chorePlanID', plan.id)
        .orderBy('shifts.startTime', 'asc')
        .orderBy('schedules.name', 'asc'),
      knex<RequirementOverrideRow>('chore_plan_requirement_overrides')
        .join(
          'users',
          'chore_plan_requirement_overrides.userID',
          '=',
          'users.id',
        )
        .select(
          'chore_plan_requirement_overrides.userID',
          'chore_plan_requirement_overrides.choreRequirement',
          'chore_plan_requirement_overrides.eventRequirement',
          'chore_plan_requirement_overrides.dinnerRequirement',
          'chore_plan_requirement_overrides.reason',
          'users.firstName',
          'users.lastName',
          'users.playaName',
        )
        .where('chore_plan_requirement_overrides.chorePlanID', plan.id),
    ]);

    const uniqueMembers = [
      ...new Map(
        members.map((member) => [Number(member.userID), member]),
      ).values(),
    ];
    const memberIDs = uniqueMembers.map((member) => Number(member.userID));
    const memberIDSet = new Set(memberIDs);
    const activeRequirementOverrides = requirementOverrides.filter((override) =>
      memberIDSet.has(Number(override.userID)),
    );
    const assignmentColumns = [
      'shifts.id as shiftID',
      'shift_participants.userID',
      'schedules.plannerKey as schedulePlannerKey',
      'shifts.startTime',
      'shifts.endTime',
    ];
    const [planAssignments, rosterAssignments] = await Promise.all([
      knex<ReadinessAssignmentRow>('shift_participants')
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(assignmentColumns)
        .where('schedules.chorePlanID', plan.id),
      memberIDs.length
        ? knex<ReadinessAssignmentRow>('shift_participants')
            .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
            .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
            .select(assignmentColumns)
            .whereIn('shift_participants.userID', memberIDs)
        : Promise.resolve([]),
    ]);

    const defaultRequirements = requirementsFromColumns(plan);
    const overrideByUserID = new Map(
      activeRequirementOverrides.map((override) => [
        Number(override.userID),
        override,
      ]),
    );
    const requirementsFor = (userID: number): ChorePlanRequirements => {
      const override = overrideByUserID.get(userID);
      return override
        ? effectiveRequirements(
            defaultRequirements,
            requirementsFromColumns(override),
          )
        : defaultRequirements;
    };
    const assignmentsByUserID = new Map<number, ReadinessAssignmentRow[]>();
    const rosterAssignmentsByUserID = new Map<
      number,
      ReadinessAssignmentRow[]
    >();
    const participantCountByShiftID = new Map<number, number>();
    planAssignments.forEach((assignment) => {
      const userID = Number(assignment.userID);
      assignmentsByUserID.set(userID, [
        ...(assignmentsByUserID.get(userID) ?? []),
        assignment,
      ]);
      const shiftID = Number(assignment.shiftID);
      participantCountByShiftID.set(
        shiftID,
        (participantCountByShiftID.get(shiftID) ?? 0) + 1,
      );
    });
    rosterAssignments.forEach((assignment) => {
      const userID = Number(assignment.userID);
      rosterAssignmentsByUserID.set(userID, [
        ...(rosterAssignmentsByUserID.get(userID) ?? []),
        assignment,
      ]);
    });

    const shiftReadiness: ChorePlanReadinessShift[] = shifts.map((shift) => {
      const participantCount =
        participantCountByShiftID.get(Number(shift.shiftID)) ?? 0;
      const requiredParticipants = Number(shift.requiredParticipants);
      let status: ChorePlanReadinessShift['status'] = 'full';
      if (participantCount < requiredParticipants) {
        status = 'underfilled';
      } else if (participantCount > requiredParticipants) {
        status = 'overfilled';
      }
      return {
        shiftID: Number(shift.shiftID),
        scheduleName: shift.scheduleName,
        startTime: isoDate(shift.startTime),
        endTime: isoDate(shift.endTime),
        requiredParticipants,
        participantCount,
        status,
      };
    });

    const incompleteMembers: ChorePlanReadiness['incompleteMembers'] = [];
    const noFeasibleChoices: ChorePlanReadiness['noFeasibleChoices'] = [];
    const categoryTotals = new Map(
      CHORE_PLAN_KINDS.map((kind) => [
        kind,
        {
          completeMembers: 0,
          incompleteMembers: 0,
          requiredSpots: 0,
        },
      ]),
    );

    uniqueMembers.forEach((member) => {
      const userID = Number(member.userID);
      const requirements = requirementsFor(userID);
      const assignments = assignmentsByUserID.get(userID) ?? [];
      const allAssignments = rosterAssignmentsByUserID.get(userID) ?? [];
      const missing: Partial<ChorePlanRequirements> = {};

      CHORE_PLAN_KINDS.forEach((kind) => {
        const totals = categoryTotals.get(kind);
        if (!totals) {
          return;
        }
        totals.requiredSpots += requirements[kind];
        const assignedShiftIDs = new Set(
          assignments
            .filter(
              (assignment) =>
                chorePlanKind(assignment.schedulePlannerKey) === kind,
            )
            .map((assignment) => Number(assignment.shiftID)),
        );
        const remaining = Math.max(
          requirements[kind] - assignedShiftIDs.size,
          0,
        );
        if (remaining === 0) {
          totals.completeMembers += 1;
          return;
        }

        totals.incompleteMembers += 1;
        missing[kind] = remaining;
        const categoryShifts = shifts.filter(
          (shift) =>
            chorePlanKind(shift.schedulePlannerKey) === kind &&
            !assignedShiftIDs.has(Number(shift.shiftID)),
        );
        const attendanceCompatible = categoryShifts.filter((shift) =>
          shiftTimeRangeContains(
            {
              startTime: member.estimatedArrivalDate,
              endTime: member.estimatedDepartureDate,
            },
            shift,
          ),
        );
        const conflictFree = attendanceCompatible.filter((shift) =>
          allAssignments.every(
            (assignment) =>
              Number(assignment.shiftID) === Number(shift.shiftID) ||
              !shiftTimeRangesOverlap(shift, assignment),
          ),
        );
        const feasible = conflictFree.filter(
          (shift) =>
            (participantCountByShiftID.get(Number(shift.shiftID)) ?? 0) <
            Number(shift.requiredParticipants),
        );
        if (feasible.length > 0) {
          return;
        }

        let reason = `No remaining ${kind} shifts exist.`;
        if (categoryShifts.length > 0 && attendanceCompatible.length === 0) {
          reason = 'Every remaining shift falls outside the attendance window.';
        } else if (
          attendanceCompatible.length > 0 &&
          conflictFree.length === 0
        ) {
          reason =
            'Every shift during attendance conflicts with another assignment.';
        } else if (conflictFree.length > 0) {
          reason = 'Every attendance-compatible, conflict-free shift is full.';
        }
        noFeasibleChoices.push({
          userID,
          name: signupName(member),
          kind,
          reason,
        });
      });

      if (Object.keys(missing).length > 0) {
        incompleteMembers.push({ userID, name: signupName(member), missing });
      }
    });

    const categories = Object.fromEntries(
      CHORE_PLAN_KINDS.map((kind) => {
        const totals = categoryTotals.get(kind) ?? {
          completeMembers: 0,
          incompleteMembers: 0,
          requiredSpots: 0,
        };
        return [
          kind,
          {
            kind,
            ...totals,
            assignedSpots: planAssignments.filter(
              (assignment) =>
                chorePlanKind(assignment.schedulePlannerKey) === kind,
            ).length,
          },
        ];
      }),
    ) as ChorePlanReadiness['categories'];

    return {
      planID: Number(plan.id),
      rosterID,
      plannerHeadcount: Number(plan.camperCount),
      actualRosterCount: memberIDs.length,
      headcountDifference: memberIDs.length - Number(plan.camperCount),
      categories,
      underfilledShifts: shiftReadiness.filter(
        (shift) => shift.status === 'underfilled',
      ),
      fullShifts: shiftReadiness.filter((shift) => shift.status === 'full'),
      overfilledShifts: shiftReadiness.filter(
        (shift) => shift.status === 'overfilled',
      ),
      incompleteMembers: incompleteMembers.sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
      noFeasibleChoices: noFeasibleChoices.sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
      requirementExceptions: activeRequirementOverrides
        .map((override) => {
          const requirements = effectiveRequirements(
            defaultRequirements,
            requirementsFromColumns(override),
          );
          return {
            userID: Number(override.userID),
            name: signupName(override),
            type: CHORE_PLAN_KINDS.every((kind) => requirements[kind] === 0)
              ? ('exemption' as const)
              : ('override' as const),
            requirements,
            reason: override.reason,
          };
        })
        .sort((first, second) => first.name.localeCompare(second.name)),
      generatedAt: new Date().toISOString(),
    };
  }
}
