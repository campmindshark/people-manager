import React from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useRecoilValue } from 'recoil';
import { styled } from '@mui/material/styles';
import RosterParticipantViewModel from 'backend/view_models/roster_participant';
import { CurrentRosterParticipantsState } from '../state/roster';
import BurningManDateFormatter from '../utils/datetime/formatter';

const HeaderTableCell = styled(TableCell)({
  top: '60px',
});

const skillsString = (skills: string[]): string => {
  if (!skills || skills.length === 0) {
    return '';
  }
  let skillString = '';
  for (let i = 0; i < skills.length; i += 1) {
    skillString += skills[i];
    if (i < skills.length - 1) {
      skillString += ', ';
    }
  }
  return skillString;
};

const participantToRow = (participant: RosterParticipantViewModel) => (
  <TableRow key={participant.user.id}>
    <TableCell component="th" scope="row">
      {participant.user.firstName} {participant.user.lastName}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.user.playaName}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.user.location}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.user.phoneNumber}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.user.email}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.probabilityOfAttending}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.hasTicket ? 'Yes' : 'No'}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.extraTickets ? 'Yes' : 'No'}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.yearsAttended}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.yearsAtCamp.join(', ')}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.user.referralName}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.sleepingArrangement}
    </TableCell>
    <TableCell component="th" scope="row">
      {BurningManDateFormatter.format(
        new Date(participant.rosterParticipant.estimatedArrivalDate),
      )}
    </TableCell>
    <TableCell component="th" scope="row">
      {BurningManDateFormatter.format(
        new Date(participant.rosterParticipant.estimatedDepartureDate),
      )}
    </TableCell>
    <TableCell component="th" scope="row">
      {skillsString(participant.user.skillsOfNote)},
      {participant.user.skillsNotInList}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.earlyArrivalInterest ? 'Yes' : 'No'}
    </TableCell>
    <TableCell component="th" scope="row">
      {participant.rosterParticipant.postBurnInterest ? 'Yes' : 'No'}
    </TableCell>
  </TableRow>
);

function RosterTable() {
  const participants = useRecoilValue(CurrentRosterParticipantsState);

  const orderedParticipants = [...participants].sort((a, b) => {
    if (a.signupDate < b.signupDate) {
      return -1;
    }
    if (a.signupDate > b.signupDate) {
      return 1;
    }
    return 0;
  });

  return (
    <Table
      stickyHeader
      sx={{ minWidth: 650, width: '100%' }}
      aria-label="sticky table"
    >
      <TableHead>
        <TableRow>
          <HeaderTableCell>Name</HeaderTableCell>
          <HeaderTableCell>Playa Name</HeaderTableCell>
          <HeaderTableCell>Location</HeaderTableCell>
          <HeaderTableCell>Phone</HeaderTableCell>
          <HeaderTableCell>Email</HeaderTableCell>
          <HeaderTableCell>Probability of Attending</HeaderTableCell>
          <HeaderTableCell>Ticket</HeaderTableCell>
          <HeaderTableCell>Extra Tickets</HeaderTableCell>
          <HeaderTableCell>Years Attended</HeaderTableCell>
          <HeaderTableCell>Years At Camp</HeaderTableCell>
          <HeaderTableCell>Referral Name</HeaderTableCell>
          <HeaderTableCell>Sleeping Arrangement</HeaderTableCell>
          <HeaderTableCell>Estimated Arrival</HeaderTableCell>
          <HeaderTableCell>Estimated Departure</HeaderTableCell>
          <HeaderTableCell>Skills</HeaderTableCell>
          <HeaderTableCell>Interested in EA</HeaderTableCell>
          <HeaderTableCell>Interested in Post Burn</HeaderTableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {orderedParticipants.map(participantToRow)}
        {orderedParticipants.map(participantToRow)}
        {orderedParticipants.map(participantToRow)}
        {orderedParticipants.map(participantToRow)}
        {orderedParticipants.map(participantToRow)}
      </TableBody>
    </Table>
  );
}

export default RosterTable;
