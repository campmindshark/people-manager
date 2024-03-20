import { selector } from 'recoil';
import Roster from 'backend/models/roster/roster';
import SignupStatus from 'backend/view_models/signup_status';
import RosterParticipantViewModel from 'backend/view_models/roster_participant';
import { getFrontendConfig } from '../config/config';
import BackendRosterClient from '../api/roster/roster';

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);

export const CurrentRosterID = 1;

export const CurrentRosterState = selector<Roster>({
  key: 'currentRoster',
  get: async () => {
    const roster = await rosterClient.GetRosterByID(CurrentRosterID);
    return roster;
  },
});

export const CurrentRosterParticipantsState = selector<
  RosterParticipantViewModel[]
>({
  key: 'currentRosterParticipants',
  get: async ({ get }) => {
    const roster = get(CurrentRosterState);
    if (!roster) {
      return [];
    }
    const participants = await rosterClient.GetRosterParticipants(roster.id);
    return participants;
  },
});

export const CurrentRosterParticipantsSignupStatusState = selector<
  SignupStatus[]
>({
  key: 'currentRosterParticipantsSignupStatus',
  get: async ({ get }) => {
    const roster = get(CurrentRosterState);
    const signupStatuses = await rosterClient.GetAllSignupStatusesForRoster(
      roster.id,
    );
    return signupStatuses;
  },
});
