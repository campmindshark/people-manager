import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';

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
      rosterID: rosterID,
      userID: userID,
    });

    await query;

    return true;
  }
}
