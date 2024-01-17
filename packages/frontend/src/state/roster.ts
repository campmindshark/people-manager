import { selector } from 'recoil';
import Roster from 'backend/models/roster/roster';
import User from 'backend/models/user/user';
import { GetFrontendConfig } from '../config/config';
import BackendRosterClient from '../api/roster/roster';

const frontendConfig = GetFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);

export const CurrentRosterState = selector<Roster>({
  key: 'currentRoster',
  get: async () => {
    const roster = await rosterClient.GetRosterByID(1);
    console.log(roster);
    return roster;
  },
});

export const CurrentRosterParticipantsState = selector<User[]>({
  key: 'currentRosterParticipants',
  get: async ({ get }) => {
    const roster = get(CurrentRosterState);
    const participants = await rosterClient.GetRosterParticipants(roster.id);
    return participants;
  },
});
