import Knex, { Knex as KnexInstance } from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import User from '../models/user/user';
import RosterParticipantViewModel, {
  RosterParticipantViewModelWithPrivateFields,
} from '../view_models/roster_participant';

const knex = Knex(knexConfig[getConfig().Environment]);

export default class RosterController {
  public static async UnregisterParticipantFromRoster(
    rosterID: number,
    userID: number,
    database: KnexInstance = knex,
  ): Promise<boolean> {
    const deleted = await this.UnregisterParticipantsFromRoster(
      rosterID,
      [userID],
      database,
    );

    return deleted > 0;
  }

  public static async UnregisterParticipantsFromRoster(
    rosterID: number,
    userIDs: number[],
    database: KnexInstance = knex,
  ): Promise<number> {
    const orderedUserIDs = [...new Set(userIDs)].sort(
      (first, second) => first - second,
    );
    if (orderedUserIDs.length === 0) {
      return 0;
    }

    return database.transaction(async (transaction): Promise<number> => {
      await transaction('users')
        .select('id')
        .whereIn('id', orderedUserIDs)
        .orderBy('id')
        .forNoKeyUpdate();

      const participants = await transaction('roster_participants')
        .select('id', 'userID')
        .where({ rosterID })
        .whereIn('userID', orderedUserIDs)
        .orderBy('userID')
        .forUpdate();
      if (participants.length === 0) {
        return 0;
      }

      const participantUserIDs = participants.map(({ userID }) =>
        Number(userID),
      );
      const shifts = await transaction('shifts as shift')
        .innerJoin('schedules as schedule', 'schedule.id', 'shift.scheduleID')
        .select('shift.id')
        .where('schedule.rosterID', rosterID)
        .orderBy('shift.id')
        .forUpdate('shift');
      const shiftIDs = shifts.map(({ id }) => Number(id));
      if (shiftIDs.length > 0) {
        await transaction('shift_participants')
          .whereIn('userID', participantUserIDs)
          .whereIn('shiftID', shiftIDs)
          .del();
      }

      const deleted = await transaction('roster_participants')
        .whereIn(
          'id',
          participants.map(({ id }) => id),
        )
        .del();
      return Number(deleted);
    });
  }

  public static async RegisterParticipantForRoster(
    rosterID: number,
    userID: number,
  ): Promise<boolean> {
    const query = knex('roster_participants').insert({
      rosterID,
      userID,
    });

    await query;

    return true;
  }

  public static async GetRosterParticipantViewModel(
    user: User,
    rosterID: number,
  ): Promise<RosterParticipantViewModel> {
    const participantQuery = knex('roster_participants')
      .where('userID', user.id)
      .andWhere('rosterID', rosterID);
    const participant = await participantQuery;
    return {
      user,
      rosterParticipant: participant[0],
      signupDate: participant[0].created_at,
    };
  }

  public static async GetRosterParticipantsViewModelWithPrivateFields(
    user: User,
  ): Promise<RosterParticipantViewModelWithPrivateFields> {
    const participantQuery = knex('roster_participants').where(
      'userID',
      user.id,
    );
    const participant = await participantQuery;

    const privateProfileQuery = knex('private_profiles').where(
      'userID',
      user.id,
    );
    const privateProfile = await privateProfileQuery;

    return {
      user,
      rosterParticipant: participant[0],
      signupDate: participant[0].created_at,
      privateProfile: privateProfile[0],
    };
  }
}
