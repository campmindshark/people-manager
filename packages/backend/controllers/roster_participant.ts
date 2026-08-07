import { Knex } from 'knex';
import RosterParticipant from '../models/roster_participant/roster_participant';
import { shiftTimeRangeContains, ShiftTimeRange } from '../utils/shiftTime';

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
    database: Knex = RosterParticipant.knex(),
  ): Promise<RosterParticipantRemovalResult> {
    const uniqueUserIDs = [...new Set(userIDs)].sort(
      (first, second) => first - second,
    );

    return database.transaction(async (transaction) => {
      await transaction('users')
        .select('id')
        .whereIn('id', uniqueUserIDs)
        .orderBy('id')
        .forUpdate();
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
