import User from '../models/user/user';
import RosterParticipant from '../models/roster_participant/roster_participant';

export default interface RosterParticipantViewModel {
  user: User;
  rosterParticipant: RosterParticipant;
}
