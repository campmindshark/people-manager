import { selector } from 'recoil';
import Roster from 'backend/models/roster/roster';
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
    console.log(roster);
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
    // for (let i = 0; i < participants.length; i += 1) {
    //   participants[i].rosterParticipant.estimatedArrivalDate = new Date(
    //     participants[i].rosterParticipant.estimatedArrivalDate,
    //   );
    //   participants[i].rosterParticipant.estimatedDepartureDate = new Date(
    //     participants[i].rosterParticipant.estimatedDepartureDate,
    //   );
    // }

    console.log(participants);

    return participants;
  },
});
