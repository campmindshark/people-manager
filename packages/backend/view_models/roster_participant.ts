import PrivateProfile from 'models/user/user_private';
import User from '../models/user/user';
import RosterParticipant from '../models/roster_participant/roster_participant';

export default interface RosterParticipantViewModel {
  user: User;
  rosterParticipant: RosterParticipant;
  signupDate: Date;
}

export interface RosterParticipantViewModelWithPrivateFields
  extends RosterParticipantViewModel {
  privateProfile: PrivateProfile;
}

function quoteWrap(value: string): string {
  if (!value || value == null || value === '') {
    return '""';
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export function CreateCSVHeader(): string {
  const columns: string[] = [
    'googleID',
    'firstName',
    'lastName',
    'playaName',
    'email',
    'phoneNumber',
    'location',
    'referralName',
    'skillsOfNote',
    'skillsNotInList',
    'signupDate',
    'probabilityOfAttending',
    'hasTicket',
    'hasVehiclePass',
    'extraTickets',
    'yearsAttended',
    'yearsAtCamp',
    'estimatedArrivalDate',
    'estimatedDepartureDate',
    'sleepingArrangement',
    'earlyArrivalInterest',
    'postBurnInterest',
    'hasReadEssentialMindshark',
    'agreesToParticipateInTearDown',
    'agreesToParticipateInShifts',
    'agreesToPayDues',
    'emergencyContactName',
    'emergencyContactPhone',
    'medications',
    'allergies',
    'dietaryRestrictions',
  ];

  return columns.join(',');
}

export function CreateCSVRow(
  participant: RosterParticipantViewModelWithPrivateFields,
): string {
  let yearsAtCamp: number[] = [];
  if (participant.rosterParticipant.yearsAtCamp !== null) {
    yearsAtCamp = participant.rosterParticipant.yearsAtCamp;
  }

  const columns: string[] = [
    quoteWrap(participant.user.googleID),
    quoteWrap(participant.user.firstName),
    quoteWrap(participant.user.lastName),
    quoteWrap(participant.user.playaName),
    quoteWrap(participant.user.email),
    quoteWrap(participant.user.phoneNumber),
    quoteWrap(participant.user.location),
    quoteWrap(participant.user.referralName),
    quoteWrap(JSON.stringify(participant.user.skillsOfNote)),
    quoteWrap(participant.user.skillsNotInList),
    quoteWrap(new Date(participant.signupDate).toISOString()),
    quoteWrap(participant.rosterParticipant.probabilityOfAttending.toString()),
    quoteWrap(participant.rosterParticipant.hasTicket.toString()),
    quoteWrap(participant.rosterParticipant.hasVehiclePass.toString()),
    quoteWrap(participant.rosterParticipant.extraTickets.toString()),
    quoteWrap(
      participant.rosterParticipant.yearsAttended
        ? participant.rosterParticipant.yearsAttended.toString()
        : '',
    ),
    quoteWrap(yearsAtCamp.join(',')),
    quoteWrap(
      new Date(
        participant.rosterParticipant.estimatedArrivalDate,
      ).toISOString(),
    ),
    quoteWrap(
      new Date(
        participant.rosterParticipant.estimatedDepartureDate,
      ).toISOString(),
    ),
    quoteWrap(participant.rosterParticipant.sleepingArrangement),
    quoteWrap(participant.rosterParticipant.earlyArrivalInterest.toString()),
    quoteWrap(participant.rosterParticipant.postBurnInterest.toString()),
    quoteWrap(
      participant.rosterParticipant.hasReadEssentialMindshark.toString(),
    ),
    quoteWrap(
      participant.rosterParticipant.agreesToParticipateInTearDown.toString(),
    ),
    quoteWrap(
      participant.rosterParticipant.agreesToParticipateInShifts.toString(),
    ),
    quoteWrap(participant.rosterParticipant.agreesToPayDues.toString()),
    quoteWrap(participant.privateProfile?.emergencyContactName),
    quoteWrap(participant.privateProfile?.emergencyContactPhone),
    quoteWrap(participant.privateProfile?.medications),
    quoteWrap(participant.privateProfile?.allergies),
    quoteWrap(participant.privateProfile?.dietaryRestrictions),
  ];

  return columns.join(',');
}
