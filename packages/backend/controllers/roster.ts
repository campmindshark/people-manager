import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import User from '../models/user/user';
import RosterParticipantViewModel from '../view_models/roster_participant';

const knex = Knex(knexConfig[getConfig().Environment]);

export default class RosterController {
  public static async UnregisterParticipantFromRoster(
    rosterID: number,
    userID: number,
  ): Promise<boolean> {
    const query = knex('roster_participants')
      .where('rosterID', rosterID)
      .andWhere('userID', userID)
      .del();

    await query;

    return true;
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
  ): Promise<RosterParticipantViewModel> {
    const participantQuery = knex('roster_participants').where(
      'userID',
      user.id,
    );
    const participant = await participantQuery;
    return {
      user,
      rosterParticipant: participant[0],
      signupDate: participant[0].created_at,
    };
  }
}
