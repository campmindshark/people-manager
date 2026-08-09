import { Knex } from 'knex';
import RosterParticipant from '../models/roster_participant/roster_participant';
import {
  requirementsFromColumns,
  ChorePlanRequirementColumns,
} from '../utils/chorePlanRequirements';
import { shiftTimeRangeContains, ShiftTimeRange } from '../utils/shiftTime';

const ROSTER_REMOVAL_REQUIREMENT_CLEAR_REASON = 'Roster membership ended.';

interface ChorePlanRow extends ChorePlanRequirementColumns {
  id: number;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  userID: number;
  reason: string;
}

interface RosterAssignmentRow extends ShiftTimeRange {
  assignmentID: number;
}

interface RosterParticipantRow {
  id: number;
  userID: number;
}

export interface RosterParticipantRemovalResult {
  deletedCount: number;
  removedAssignmentCount: number;
}

export default class RosterParticipantController {
  public static async ReconcileAttendanceWindow(
    transaction: Knex.Transaction,
    rosterID: number,
    userID: number,
    attendanceWindow: ShiftTimeRange,
  ): Promise<number> {
    const assignments = await transaction<RosterAssignmentRow>(
      'shift_participants as assignment',
    )
      .innerJoin('shifts as shift', 'shift.id', 'assignment.shiftID')
      .innerJoin('schedules as schedule', 'schedule.id', 'shift.scheduleID')
      .select(
        'assignment.id as assignmentID',
        'shift.startTime',
        'shift.endTime',
      )
      .where('assignment.userID', userID)
      .where('schedule.rosterID', rosterID)
      .orderBy('assignment.id')
      .forUpdate('assignment');

    const invalidAssignmentIDs = assignments
      .filter(
        (assignment) => !shiftTimeRangeContains(attendanceWindow, assignment),
      )
      .map(({ assignmentID }) => Number(assignmentID));

    if (invalidAssignmentIDs.length === 0) {
      return 0;
    }

    return transaction('shift_participants')
      .whereIn('id', invalidAssignmentIDs)
      .del();
  }

  public static async RemoveFromRoster(
    rosterID: number,
    userIDs: number[],
    actorUserID: number,
    database: Knex = RosterParticipant.knex(),
  ): Promise<RosterParticipantRemovalResult> {
    const uniqueUserIDs = [...new Set(userIDs)].sort(
      (first, second) => first - second,
    );
    if (uniqueUserIDs.length === 0) {
      return { deletedCount: 0, removedAssignmentCount: 0 };
    }
    const lockUserIDs = [...new Set([...uniqueUserIDs, actorUserID])].sort(
      (first, second) => first - second,
    );

    return database.transaction(async (transaction) => {
      const chorePlan = (await transaction<ChorePlanRow>('chore_plans')
        .select(
          'id',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('rosterID', rosterID)
        // Requirement mutations lock the plan before participant rows. Keep
        // that order here so the removal audit's foreign-key check cannot
        // deadlock with a concurrent requirement mutation.
        .forShare()
        .first()) as ChorePlanRow | undefined;
      await transaction('users')
        .select('id')
        .whereIn('id', lockUserIDs)
        .orderBy('id')
        // Lock the audit actor before assignment rows while retaining
        // compatibility with the audit foreign key's FOR KEY SHARE lock.
        .forNoKeyUpdate();
      const participants = (await transaction<RosterParticipantRow>(
        'roster_participants',
      )
        .select('id', 'userID')
        .where('rosterID', rosterID)
        .whereIn('userID', uniqueUserIDs)
        .orderBy('userID')
        .forUpdate()) as RosterParticipantRow[];

      if (participants.length === 0) {
        return { deletedCount: 0, removedAssignmentCount: 0 };
      }

      const participantUserIDs = participants.map(({ userID }) => userID);
      const rosterShiftIDs = transaction('shifts')
        .innerJoin('schedules', 'schedules.id', 'shifts.scheduleID')
        .select('shifts.id')
        .where('schedules.rosterID', rosterID);
      const removedAssignmentCount = await transaction('shift_participants')
        .whereIn('userID', participantUserIDs)
        .whereIn('shiftID', rosterShiftIDs)
        .del();

      if (chorePlan) {
        const overrides = (await transaction<RequirementOverrideRow>(
          'chore_plan_requirement_overrides',
        )
          .select(
            'userID',
            'choreRequirement',
            'eventRequirement',
            'dinnerRequirement',
            'reason',
          )
          .where('chorePlanID', chorePlan.id)
          .whereIn('userID', participantUserIDs)
          .orderBy('userID')
          .forUpdate()) as RequirementOverrideRow[];
        if (overrides.length > 0) {
          await transaction('chore_plan_requirement_overrides')
            .where('chorePlanID', chorePlan.id)
            .whereIn(
              'userID',
              overrides.map(({ userID }) => userID),
            )
            .del();
          const planRequirements = requirementsFromColumns(chorePlan);
          await transaction('chore_plan_audit_entries').insert(
            overrides.map((override) => ({
              chorePlanID: chorePlan.id,
              actorUserID,
              action: 'participant_requirements_cleared',
              details: {
                participantUserID: override.userID,
                previousRequirements: requirementsFromColumns(
                  override,
                  planRequirements,
                ),
                requirements: planRequirements,
                previousReason: override.reason,
                reason: ROSTER_REMOVAL_REQUIREMENT_CLEAR_REASON,
                removedAssignments: [],
              },
            })),
          );
        }
      }

      const deletedCount = await transaction('roster_participants')
        .whereIn(
          'id',
          participants.map(({ id }) => id),
        )
        .del();

      return { deletedCount, removedAssignmentCount };
    });
  }
}
