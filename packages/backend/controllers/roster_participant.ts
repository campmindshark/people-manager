import { Knex } from 'knex';
import RosterParticipant from '../models/roster_participant/roster_participant';

interface RosterParticipantRow {
  id: number;
  userID: number;
}

export interface RosterParticipantRemovalResult {
  deletedCount: number;
  removedAssignmentCount: number;
}

export default class RosterParticipantController {
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
