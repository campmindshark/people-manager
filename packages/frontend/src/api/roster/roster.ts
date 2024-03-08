import axios from 'axios';
import Roster from 'backend/models/roster/roster';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import RosterParticipantViewModel from 'backend/view_models/roster_participant';

export interface RosterClient {
  GetAllRosters(): Promise<Roster[]>;
  GetRosterByID(rosterID: number): Promise<Roster>;
  GetRosterParticipants(
    rosterID: number,
  ): Promise<RosterParticipantViewModel[]>;
  Signup(
    rosterID: number,
    rosterParticipant: RosterParticipant,
  ): Promise<RosterParticipant>;
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

  async GetRosterParticipants(
    rosterID: number,
  ): Promise<RosterParticipantViewModel[]> {
    const { data } = await axios.get<RosterParticipantViewModel[]>(
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

  async Signup(
    rosterID: number,
    rosterParticipant: RosterParticipant,
  ): Promise<RosterParticipant> {
    console.log(
      `Signing up for roster ${rosterID} with this data ${rosterParticipant}`,
    );
    const { data } = await axios.post<RosterParticipant>(
      `${this.baseApiURL}/api/roster_participants/${rosterID}`,
      rosterParticipant,
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
