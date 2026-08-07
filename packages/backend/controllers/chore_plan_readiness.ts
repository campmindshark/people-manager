import { Knex } from 'knex';
import {
  CHORE_PLAN_KINDS,
  ChorePlanKind,
  ChorePlanStatus,
} from '../domain/chore_planning';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanReadinessError from '../utils/chorePlanReadinessError';
import {
  ChorePlanRequirementColumns,
  effectiveRequirements,
} from '../utils/chorePlanRequirements';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';
import {
  ChorePlanReadinessFeasibilityIssue,
  ChorePlanReadinessParticipantDataIssue,
  ChorePlanReadinessResponse,
  ChorePlanReadinessShift,
} from '../view_models/chore_plan_readiness';

interface PlanRow extends ChorePlanRequirementColumns {
  id: number;
  status: ChorePlanStatus;
  camperCount: number;
}

interface ParticipantRow {
  userID: number;
  firstName: string | null;
  lastName: string | null;
  playaName: string | null;
  email: string | null;
  phoneNumber: string | null;
  location: string | null;
  estimatedArrivalDate: Date | string | null;
  estimatedDepartureDate: Date | string | null;
  hasCompletePrivateProfile: boolean;
}

interface GeneratedShiftRow {
  shiftID: number;
  kind: ChorePlanKind;
  scheduleName: string;
  startTime: Date | string;
  endTime: Date | string;
  requiredParticipants: number;
}

interface AssignmentRow {
  shiftID: number;
  userID: number;
  startTime: Date | string;
  endTime: Date | string;
  kind?: ChorePlanKind;
}

interface OverrideRow extends ChorePlanRequirementColumns {
  userID: number;
  reason: string;
}

interface TimestampRow {
  generatedAt: Date | string;
}

function nonEmpty(value: string | null): boolean {
  return String(value ?? '').trim().length > 0;
}

function participantName(participant: ParticipantRow): string {
  const firstName = String(participant.firstName ?? '').trim();
  const lastInitial = String(participant.lastName ?? '')
    .trim()
    .slice(0, 1);
  const realName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
  const playaName = String(participant.playaName ?? '').trim();
  if (playaName && realName) {
    return `${playaName} (${realName})`;
  }
  return playaName || realName || `Participant ${participant.userID}`;
}

function milliseconds(value: Date | string | null): number | null {
  if (value === null) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasAttendanceWindow(participant: ParticipantRow): boolean {
  const arrival = milliseconds(participant.estimatedArrivalDate);
  const departure = milliseconds(participant.estimatedDepartureDate);
  return arrival !== null && departure !== null && arrival < departure;
}

function attendanceContains(
  participant: ParticipantRow,
  shift: GeneratedShiftRow,
): boolean {
  const arrival = milliseconds(participant.estimatedArrivalDate);
  const departure = milliseconds(participant.estimatedDepartureDate);
  const start = milliseconds(shift.startTime);
  const end = milliseconds(shift.endTime);
  return (
    arrival !== null &&
    departure !== null &&
    start !== null &&
    end !== null &&
    arrival <= start &&
    end <= departure
  );
}

function overlaps(first: GeneratedShiftRow, second: AssignmentRow): boolean {
  const firstStart = milliseconds(first.startTime);
  const firstEnd = milliseconds(first.endTime);
  const secondStart = milliseconds(second.startTime);
  const secondEnd = milliseconds(second.endTime);
  if (
    firstStart === null ||
    firstEnd === null ||
    secondStart === null ||
    secondEnd === null
  ) {
    return true;
  }
  return firstStart < secondEnd && secondStart < firstEnd;
}

function profileIssues(
  participant: ParticipantRow,
): ChorePlanReadinessParticipantDataIssue | null {
  const missing: ChorePlanReadinessParticipantDataIssue['missing'] = [];
  if (
    ![
      participant.firstName,
      participant.lastName,
      participant.email,
      participant.phoneNumber,
      participant.location,
    ].every(nonEmpty)
  ) {
    missing.push('public_profile');
  }
  if (!participant.hasCompletePrivateProfile) {
    missing.push('private_profile');
  }
  if (!hasAttendanceWindow(participant)) {
    missing.push('attendance_window');
  }
  return missing.length
    ? {
        userID: Number(participant.userID),
        name: participantName(participant),
        missing,
      }
    : null;
}

function feasibilityIssue(
  participant: ParticipantRow,
  kind: ChorePlanKind,
  shifts: GeneratedShiftRow[],
  assignedShiftIDs: Set<number>,
  assignments: AssignmentRow[],
  assignmentCountsByShiftID: Map<number, number>,
): ChorePlanReadinessFeasibilityIssue | null {
  const details = {
    userID: Number(participant.userID),
    name: participantName(participant),
    kind,
  };
  if (!hasAttendanceWindow(participant)) {
    return {
      ...details,
      reason: 'missing_attendance',
      message: 'A valid attendance window is required to find open choices.',
    };
  }

  const categoryShifts = shifts.filter(
    (shift) =>
      shift.kind === kind && !assignedShiftIDs.has(Number(shift.shiftID)),
  );
  if (categoryShifts.length === 0) {
    return {
      ...details,
      reason: 'no_generated_shifts',
      message: `No remaining ${kind} shifts exist.`,
    };
  }
  const attendanceCompatible = categoryShifts.filter((shift) =>
    attendanceContains(participant, shift),
  );
  if (attendanceCompatible.length === 0) {
    return {
      ...details,
      reason: 'outside_attendance',
      message: 'Every remaining shift falls outside the attendance window.',
    };
  }
  const conflictFree = attendanceCompatible.filter((shift) =>
    assignments.every((assignment) => !overlaps(shift, assignment)),
  );
  if (conflictFree.length === 0) {
    return {
      ...details,
      reason: 'assignment_conflicts',
      message: 'Every shift during attendance conflicts with an assignment.',
    };
  }
  const openShifts = conflictFree.filter(
    (shift) =>
      (assignmentCountsByShiftID.get(Number(shift.shiftID)) ?? 0) <
      Number(shift.requiredParticipants),
  );
  if (openShifts.length === 0) {
    return {
      ...details,
      reason: 'shifts_full',
      message: 'Every attendance-compatible, conflict-free shift is full.',
    };
  }
  return null;
}

export default class ChorePlanReadinessController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  async getByRosterID(rosterID: number): Promise<ChorePlanReadinessResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanReadinessError('Roster not found.', 404);
      }
      const plan = (await transaction<PlanRow>('chore_plans')
        .select(
          'id',
          'status',
          'camperCount',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('rosterID', rosterID)
        .first()) as PlanRow | undefined;
      if (!plan) {
        throw new ChorePlanReadinessError(
          'Create the chore plan before reviewing readiness.',
          404,
        );
      }

      const participants = (await transaction(
        'roster_participants as participant',
      )
        .innerJoin('users as user', 'user.id', 'participant.userID')
        .select(
          'participant.userID',
          'participant.estimatedArrivalDate',
          'participant.estimatedDepartureDate',
          'user.firstName',
          'user.lastName',
          'user.playaName',
          'user.email',
          'user.phoneNumber',
          'user.location',
          transaction.raw(`
            exists (
              select 1
              from private_profiles as private_profile
              where private_profile."userID" = participant."userID"
                and nullif(btrim(coalesce(private_profile."emergencyContactName", '')), '') is not null
                and nullif(btrim(coalesce(private_profile."emergencyContactPhone", '')), '') is not null
            ) as "hasCompletePrivateProfile"
          `),
        )
        .where('participant.rosterID', rosterID)
        .orderByRaw('lower(coalesce("user"."lastName", \'\'))')
        .orderByRaw('lower(coalesce("user"."firstName", \'\'))')
        .orderBy('participant.userID')) as ParticipantRow[];
      const uniqueParticipants = [
        ...new Map(
          participants.map((participant) => [
            Number(participant.userID),
            participant,
          ]),
        ).values(),
      ];
      const participantIDs = uniqueParticipants.map(({ userID }) =>
        Number(userID),
      );
      const participantIDSet = new Set(participantIDs);

      const shifts = (await transaction(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'generated.shiftID',
          'generated.kind',
          'generated.scheduleName',
          'shift.startTime',
          'shift.endTime',
          'shift.requiredParticipants',
        )
        .where('generated.chorePlanID', plan.id)
        .orderBy('generated.displayDayNumber')
        .orderBy('shift.startTime')
        .orderBy('generated.stableKey')) as GeneratedShiftRow[];
      const shiftIDs = shifts.map(({ shiftID }) => Number(shiftID));
      const planAssignments = shiftIDs.length
        ? ((await transaction('shift_participants as assignment')
            .innerJoin(
              'chore_plan_generated_shifts as generated',
              'generated.shiftID',
              'assignment.shiftID',
            )
            .innerJoin('shifts as shift', 'shift.id', 'assignment.shiftID')
            .select(
              'assignment.shiftID',
              'assignment.userID',
              'shift.startTime',
              'shift.endTime',
              'generated.kind',
            )
            .where('generated.chorePlanID', plan.id)) as AssignmentRow[])
        : [];
      const allParticipantAssignments = participantIDs.length
        ? ((await transaction('shift_participants as assignment')
            .innerJoin('shifts as shift', 'shift.id', 'assignment.shiftID')
            .select(
              'assignment.shiftID',
              'assignment.userID',
              'shift.startTime',
              'shift.endTime',
            )
            .whereIn('assignment.userID', participantIDs)) as AssignmentRow[])
        : [];
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
      const activeOverrides = overrides.filter(({ userID }) =>
        participantIDSet.has(Number(userID)),
      );
      const overrideByUserID = new Map(
        activeOverrides.map((override) => [Number(override.userID), override]),
      );

      const assignedShiftIDsByUserAndKind = new Map<
        number,
        Record<ChorePlanKind, Set<number>>
      >();
      const assignmentsByUserID = new Map<number, AssignmentRow[]>();
      const assignmentCountsByShiftID = new Map<number, number>();
      planAssignments.forEach((assignment) => {
        const userID = Number(assignment.userID);
        const shiftID = Number(assignment.shiftID);
        const assignedByKind = assignedShiftIDsByUserAndKind.get(userID) ?? {
          chore: new Set<number>(),
          event: new Set<number>(),
          dinner: new Set<number>(),
        };
        if (assignment.kind) {
          assignedByKind[assignment.kind].add(shiftID);
        }
        assignedShiftIDsByUserAndKind.set(userID, assignedByKind);
        assignmentCountsByShiftID.set(
          shiftID,
          (assignmentCountsByShiftID.get(shiftID) ?? 0) + 1,
        );
      });
      allParticipantAssignments.forEach((assignment) => {
        const userID = Number(assignment.userID);
        assignmentsByUserID.set(userID, [
          ...(assignmentsByUserID.get(userID) ?? []),
          assignment,
        ]);
      });

      const categoryTotals = new Map(
        CHORE_PLAN_KINDS.map((kind) => [
          kind,
          {
            kind,
            completeParticipants: 0,
            incompleteParticipants: 0,
            assignedShifts: 0,
            requiredShifts: 0,
          },
        ]),
      );
      const incompleteParticipants: ChorePlanReadinessResponse['incompleteParticipants'] =
        [];
      const feasibilityIssues: ChorePlanReadinessResponse['feasibilityIssues'] =
        [];

      uniqueParticipants.forEach((participant) => {
        const userID = Number(participant.userID);
        const requirements = effectiveRequirements(
          plan,
          overrideByUserID.get(userID),
        );
        const assignedByKind = assignedShiftIDsByUserAndKind.get(userID) ?? {
          chore: new Set<number>(),
          event: new Set<number>(),
          dinner: new Set<number>(),
        };
        const missing: Partial<ChorePlanRequirements> = {};
        CHORE_PLAN_KINDS.forEach((kind) => {
          const totals = categoryTotals.get(kind);
          if (!totals) {
            return;
          }
          const assigned = assignedByKind[kind].size;
          const remaining = Math.max(requirements[kind] - assigned, 0);
          totals.requiredShifts += requirements[kind];
          totals.assignedShifts += assigned;
          if (remaining === 0) {
            totals.completeParticipants += 1;
            return;
          }
          totals.incompleteParticipants += 1;
          missing[kind] = remaining;
          const issue = feasibilityIssue(
            participant,
            kind,
            shifts,
            assignedByKind[kind],
            assignmentsByUserID.get(userID) ?? [],
            assignmentCountsByShiftID,
          );
          if (issue) {
            feasibilityIssues.push(issue);
          }
        });
        if (Object.keys(missing).length > 0) {
          incompleteParticipants.push({
            userID,
            name: participantName(participant),
            missing,
          });
        }
      });

      const categories = Object.fromEntries(
        CHORE_PLAN_KINDS.map((kind) => [kind, categoryTotals.get(kind)]),
      ) as ChorePlanReadinessResponse['categories'];
      const shiftReadiness: ChorePlanReadinessShift[] = shifts.map((shift) => {
        const assignedParticipants =
          assignmentCountsByShiftID.get(Number(shift.shiftID)) ?? 0;
        const requiredParticipants = Number(shift.requiredParticipants);
        let status: ChorePlanReadinessShift['status'] = 'full';
        if (assignedParticipants < requiredParticipants) {
          status = 'underfilled';
        } else if (assignedParticipants > requiredParticipants) {
          status = 'overfilled';
        }
        return {
          shiftID: Number(shift.shiftID),
          scheduleName: shift.scheduleName,
          startTime: new Date(shift.startTime).toISOString(),
          endTime: new Date(shift.endTime).toISOString(),
          requiredParticipants,
          assignedParticipants,
          status,
        };
      });
      const nameThenKind = (
        first: { name: string; kind?: ChorePlanKind },
        second: { name: string; kind?: ChorePlanKind },
      ) => {
        const nameComparison = first.name.localeCompare(second.name);
        if (nameComparison !== 0 || !first.kind || !second.kind) {
          return nameComparison;
        }
        return (
          CHORE_PLAN_KINDS.indexOf(first.kind) -
          CHORE_PLAN_KINDS.indexOf(second.kind)
        );
      };
      const participantDataIssues = uniqueParticipants
        .map(profileIssues)
        .filter(
          (issue): issue is ChorePlanReadinessParticipantDataIssue =>
            issue !== null,
        )
        .sort(nameThenKind);
      const [timestamp] = (
        await transaction.raw('select transaction_timestamp() as "generatedAt"')
      ).rows as TimestampRow[];

      return {
        planID: Number(plan.id),
        rosterID,
        status: plan.status,
        plannerHeadcount: Number(plan.camperCount),
        actualRosterCount: uniqueParticipants.length,
        headcountDifference:
          uniqueParticipants.length - Number(plan.camperCount),
        categories,
        underfilledShifts: shiftReadiness.filter(
          ({ status }) => status === 'underfilled',
        ),
        fullShifts: shiftReadiness.filter(({ status }) => status === 'full'),
        overfilledShifts: shiftReadiness.filter(
          ({ status }) => status === 'overfilled',
        ),
        incompleteParticipants: incompleteParticipants.sort(nameThenKind),
        feasibilityIssues: feasibilityIssues.sort(nameThenKind),
        participantDataIssues,
        requirementExceptions: activeOverrides
          .map((override) => {
            const requirements = effectiveRequirements(plan, override);
            return {
              userID: Number(override.userID),
              name: participantName(
                uniqueParticipants.find(
                  ({ userID }) => Number(userID) === Number(override.userID),
                ) as ParticipantRow,
              ),
              type: CHORE_PLAN_KINDS.every((kind) => requirements[kind] === 0)
                ? ('exemption' as const)
                : ('override' as const),
              requirements,
              reason: override.reason,
            };
          })
          .sort(nameThenKind),
        generatedAt: new Date(timestamp.generatedAt).toISOString(),
      };
    });
  }
}
