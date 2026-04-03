import { atom, selector } from 'recoil';
import Roster from 'backend/models/roster/roster';
import SignupStatus from 'backend/view_models/signup_status';
import RosterParticipantViewModel, {
  RosterParticipantViewModelWithPrivateFields,
} from 'backend/view_models/roster_participant';
import { getFrontendConfig } from '../config/config';
import BackendRosterClient from '../api/roster/roster';
import BackendSettingsClient from '../api/settings/client';

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const settingsClient = new BackendSettingsClient(frontendConfig.BackendURL);

const ActiveRosterIDDefault = selector<number>({
  key: 'activeRosterIDDefault',
  get: async () => {
    const activeRosterID = await settingsClient.GetActiveRosterID();
    return activeRosterID;
  },
});

export const ActiveRosterIDState = atom<number>({
  key: 'activeRosterID',
  default: ActiveRosterIDDefault,
});

export const CurrentRosterState = selector<Roster>({
  key: 'currentRoster',
  get: async ({ get }) => {
    const activeRosterID = get(ActiveRosterIDState);
    const roster = await rosterClient.GetRosterByID(activeRosterID);
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

export const CurrentRosterParticipantsDetailedState = selector<
  RosterParticipantViewModelWithPrivateFields[]
>({
  key: 'currentRosterParticipantsDetailed',
  get: async ({ get }) => {
    const roster = get(CurrentRosterState);
    if (!roster) {
      return [];
    }
    const participants = await rosterClient.GetRosterParticipantsDetailed(
      roster.id,
    );
    return participants;
  },
});
