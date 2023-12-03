import { selector } from 'recoil';
import Roster from 'backend/models/roster/roster';
import { getConfig } from 'backend/config/config';
import User from 'backend/models/user/user';
import BackendRosterClient from '../api/roster/roster';

const appConfig = getConfig();
const rosterClient = new BackendRosterClient(appConfig.BackendURL);

export const CurrentRosterState = selector<Roster>({
  key: 'currentRoster',
  get: async () => {
    const roster = await rosterClient.GetRosterByID(appConfig.ActiveRosterID);
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
