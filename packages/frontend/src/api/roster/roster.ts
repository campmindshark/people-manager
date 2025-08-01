import axios from 'axios';
import Roster from 'backend/models/roster/roster';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import RosterParticipantViewModel, {
  RosterParticipantViewModelWithPrivateFields,
} from 'backend/view_models/roster_participant';
import BasicResponse from 'backend/models/common/basic_response';
import SignupStatus from 'backend/view_models/signup_status';
import defaultRequestConfig from '../common/requestConfig';

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
  DropOut(rosterID: number): Promise<BasicResponse>;
  RemoveUserFromRoster(
    rosterID: number,
    userID: number,
  ): Promise<BasicResponse>;
  RemoveUsersFromRoster(
    rosterID: number,
    userIDs: number[],
  ): Promise<{ success: boolean; deletedCount: number }>;
}

export default class BackendRosterClient implements RosterClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllRosters(): Promise<Roster[]> {
    const { data } = await axios.get<Roster[]>(
      `${this.baseApiURL}/api/rosters`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetRosterByID(rosterID: number): Promise<Roster> {
    const { data } = await axios.get<Roster>(
      `${this.baseApiURL}/api/rosters/${rosterID}`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetRosterParticipants(
    rosterID: number,
  ): Promise<RosterParticipantViewModel[]> {
    try {
      const { data } = await axios.get<RosterParticipantViewModel[]>(
        `${this.baseApiURL}/api/rosters/${rosterID}/participants`,
        defaultRequestConfig,
      );

      return data;
    } catch (error) {
      console.error(error);
    }

    return [];
  }

  async GetRosterParticipantsDetailed(
    rosterID: number,
  ): Promise<RosterParticipantViewModelWithPrivateFields[]> {
    try {
      const { data } = await axios.get<
        RosterParticipantViewModelWithPrivateFields[]
      >(
        `${this.baseApiURL}/api/rosters/${rosterID}/participants-detailed`,
        defaultRequestConfig,
      );

      return data;
    } catch (error) {
      console.error(error);
    }

    return [];
  }

  async GetMyRosterSignup(rosterID: number): Promise<RosterParticipant> {
    const { data } = await axios.get<RosterParticipant>(
      `${this.baseApiURL}/api/roster_participants/my-signup-by-roster/${rosterID}`,
      defaultRequestConfig,
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
      defaultRequestConfig,
    );

    return data;
  }

  async DropOut(rosterID: number): Promise<BasicResponse> {
    const { data } = await axios.post<BasicResponse>(
      `${this.baseApiURL}/api/rosters/${rosterID}/drop-out`,
      {},
      defaultRequestConfig,
    );

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async GetAllSignupStatusesForRoster(
    rosterID: number,
  ): Promise<SignupStatus[]> {
    const { data } = await axios.get<SignupStatus[]>(
      `${this.baseApiURL}/api/rosters/${rosterID}/participant-signup-statuses`,
      defaultRequestConfig,
    );

    return data;
  }

  async RemoveUserFromRoster(
    rosterID: number,
    userID: number,
  ): Promise<BasicResponse> {
    const { data } = await axios.delete<BasicResponse>(
      `${this.baseApiURL}/api/roster_participants/${rosterID}/users/${userID}`,
      defaultRequestConfig,
    );

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async RemoveUsersFromRoster(
    rosterID: number,
    userIDs: number[],
  ): Promise<{ success: boolean; deletedCount: number }> {
    const { data } = await axios.delete<{
      success: boolean;
      deletedCount: number;
    }>(`${this.baseApiURL}/api/roster_participants/${rosterID}/users`, {
      ...defaultRequestConfig,
      data: { userIds: userIDs },
    });

    return data;
  }
}
