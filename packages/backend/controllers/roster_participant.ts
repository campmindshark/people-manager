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
      'shift_participants',
    )
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
      .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
      .select(
        'shift_participants.id as assignmentID',
        'shifts.startTime',
        'shifts.endTime',
      )
      .where('shift_participants.userID', userID)
      .where('schedules.rosterID', rosterID);

    const invalidAssignmentIDs = assignments
      .filter(
        (assignment) => !shiftTimeRangeContains(attendanceWindow, assignment),
      )
      .map((assignment) => Number(assignment.assignmentID));

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
  ): Promise<RosterParticipantRemovalResult> {
    const uniqueUserIDs = [...new Set(userIDs)];

    return RosterParticipant.knex().transaction(async (transaction) => {
      await transaction('users')
        .select('id')
        .whereIn('id', uniqueUserIDs)
        .orderBy('id')
        .forUpdate();
      const participants = await transaction<RosterParticipantRow>(
        'roster_participants',
      )
        .select('id', 'userID')
        .where('rosterID', rosterID)
        .whereIn('userID', uniqueUserIDs)
        .forUpdate();

      if (participants.length === 0) {
        return { deletedCount: 0, removedAssignmentCount: 0 };
      }

      const participantUserIDs = [
        ...new Set(participants.map(({ userID }) => Number(userID))),
      ];
      const rosterShiftIDs = transaction('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select('shifts.id')
        .where('schedules.rosterID', rosterID);
      const removedAssignmentCount = await transaction('shift_participants')
        .whereIn('userID', participantUserIDs)
        .whereIn('shiftID', rosterShiftIDs)
        .del();
      const deletedCount = await transaction('roster_participants')
        .whereIn(
          'id',
          participants.map(({ id }) => Number(id)),
        )
        .del();

      return { deletedCount, removedAssignmentCount };
    });
  }
}
