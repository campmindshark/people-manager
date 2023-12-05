import axios from 'axios';
import Roster from 'backend/models/roster/roster';
import User from 'backend/models/user/user';

export interface RosterClient {
  GetAllRosters(): Promise<Roster[]>;
  GetRosterByID(rosterID: number): Promise<Roster>;
  GetRosterParticipants(rosterID: number): Promise<User[]>;
}

export default class BackendRosterClient implements RosterClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllRosters(): Promise<Roster[]> {
    const { data } = await axios.get<Roster[]>(
      `${this.baseApiURL}/api/rosters`,
      {
        withCredentials: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    );
    return data;
  }

  async GetRosterByID(rosterID: number): Promise<Roster> {
    const { data } = await axios.get<Roster>(
      `${this.baseApiURL}/api/rosters/${rosterID}`,
      {
        withCredentials: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    );
    return data;
  }

  async GetRosterParticipants(rosterID: number): Promise<User[]> {
    const { data } = await axios.get<User[]>(
      `${this.baseApiURL}/api/rosters/${rosterID}/participants`,
      {
        withCredentials: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    );
    return data;
  }
}
